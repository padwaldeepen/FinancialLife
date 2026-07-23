from datetime import date, datetime, timedelta
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from routers.budgets import get_period_range
from services.ai.rephrase import rephrase
from services.insights.advice import BudgetStatus, GoalStatus
from services.insights.advice import generate as generate_advice
from services.insights.forecast import simulate
from services.insights.recurring import RecurringCharge, TransactionInput, detect
from services.insights.safe_to_spend import compute as compute_safe_to_spend
from services.insights.trends import CategorizedTransaction, category_trends, detect_insights

router = APIRouter()

CASH_ACCOUNT_TYPES = ("checking", "savings", "cash")
FORECAST_HORIZON_DAYS = 90
DISCRETIONARY_WINDOW_DAYS = 90

# Recurring detection needs enough history to see 3+ occurrences of even a yearly
# charge — one year isn't enough margin (a yearly subscription billed on day 1
# wouldn't have a 3rd occurrence until day ~730), so this looks back further than
# the reporting endpoints do.
LOOKBACK_DAYS = 800

# Trends needs the current month, 3 trailing months, and the same month a year ago —
# 400 days covers all three with margin.
TRENDS_LOOKBACK_DAYS = 400


class RecurringChargeResponse(BaseModel):
    group_key: str
    merchant_id: int | None
    display_name: str
    transaction_type: str
    is_subscription: bool
    price_hike: bool
    avg_amount: float
    cadence: str
    monthly_equivalent: float
    next_expected_date: date
    occurrence_count: int
    confidence: float
    transaction_ids: list[int]


class DismissRequest(BaseModel):
    group_key: str


class CategoryTrendResponse(BaseModel):
    category_id: int | None
    category_name: str
    current_month_total: float
    previous_month_total: float | None
    mom_change_pct: float | None
    same_month_last_year_total: float | None
    yoy_change_pct: float | None


class InsightResponse(BaseModel):
    type: str
    category_id: int | None
    category_name: str
    message: str
    evidence: dict


class ForecastDayResponse(BaseModel):
    date: date
    balance: float
    income: float
    expenses: float


class ForecastResponse(BaseModel):
    insufficient_data: bool
    message: str | None
    days: list[ForecastDayResponse]
    crunch_points: list[date]


class AdviceCardResponse(BaseModel):
    type: str
    message: str
    evidence: dict
    ai_generated: bool


class AdviceDismissRequest(BaseModel):
    type: str


class SafeToSpendResponse(BaseModel):
    insufficient_data: bool
    message: str | None
    safe_to_spend: float | None
    cash_balance: float | None
    next_payday: date | None
    days_until_payday: int | None
    bills_before_payday: float
    goal_contributions_due: float


def _to_response(c) -> RecurringChargeResponse:
    return RecurringChargeResponse(
        group_key=c.group_key,
        merchant_id=c.merchant_id,
        display_name=c.display_name,
        transaction_type=c.transaction_type,
        is_subscription=c.is_subscription,
        price_hike=c.price_hike,
        avg_amount=float(c.avg_amount),
        cadence=c.cadence,
        monthly_equivalent=float(c.monthly_equivalent),
        next_expected_date=c.next_expected_date,
        occurrence_count=c.occurrence_count,
        confidence=c.confidence,
        transaction_ids=c.transaction_ids,
    )


async def _fetch_recurring_input(
    profile_id: int, conn: asyncpg.Connection
) -> list[TransactionInput]:
    rows = await conn.fetch(
        """SELECT t.id, t.merchant_id, m.name AS merchant_name, t.description,
                  t.transaction_type, t.amount, t.date
           FROM transactions t
           LEFT JOIN merchants m ON m.id = t.merchant_id
           WHERE t.profile_id = $1
             AND t.date >= now() - make_interval(days => $2)
           ORDER BY t.date""",
        profile_id,
        LOOKBACK_DAYS,
    )
    return [
        {
            "id": r["id"],
            "merchant_id": r["merchant_id"],
            "merchant_name": r["merchant_name"],
            "description": r["description"],
            "transaction_type": r["transaction_type"],
            "amount": r["amount"],
            "date": r["date"].date(),
        }
        for r in rows
    ]


@router.get("/recurring", response_model=list[RecurringChargeResponse])
async def recurring_charges(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    transactions = await _fetch_recurring_input(profile.id, conn)

    dismissed_rows = await conn.fetch(
        "SELECT group_key FROM dismissed_recurring_groups WHERE profile_id = $1",
        profile.id,
    )
    dismissed = {r["group_key"] for r in dismissed_rows}

    charges = [c for c in detect(transactions) if c.group_key not in dismissed]
    return [_to_response(c) for c in charges]


async def _fetch_categorized_transactions(
    profile_id: int, conn: asyncpg.Connection
) -> list[CategorizedTransaction]:
    rows = await conn.fetch(
        """SELECT c.id AS category_id, c.name AS category_name, t.transaction_type,
                  t.amount, t.date
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1
             AND t.date >= now() - make_interval(days => $2)""",
        profile_id,
        TRENDS_LOOKBACK_DAYS,
    )
    return [
        {
            "category_id": r["category_id"],
            "category_name": r["category_name"],
            "transaction_type": r["transaction_type"],
            "amount": r["amount"],
            "date": r["date"].date(),
        }
        for r in rows
    ]


@router.get("/")
async def trends_and_insights(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    transactions = await _fetch_categorized_transactions(profile.id, conn)

    today = datetime.now().date()
    trends = category_trends(transactions, today)
    insights = detect_insights(transactions, today)

    return {
        "trends": [
            CategoryTrendResponse(
                category_id=t.category_id,
                category_name=t.category_name,
                current_month_total=float(t.current_month_total),
                previous_month_total=float(t.previous_month_total)
                if t.previous_month_total is not None
                else None,
                mom_change_pct=t.mom_change_pct,
                same_month_last_year_total=float(t.same_month_last_year_total)
                if t.same_month_last_year_total is not None
                else None,
                yoy_change_pct=t.yoy_change_pct,
            )
            for t in trends
        ],
        "insights": [
            InsightResponse(
                type=i.type,
                category_id=i.category_id,
                category_name=i.category_name,
                message=i.message,
                evidence=i.evidence,
            )
            for i in insights
        ],
    }


async def _history_span_days(profile_id: int, conn: asyncpg.Connection, today: date) -> int:
    earliest_row = await conn.fetchrow(
        "SELECT MIN(date) AS earliest FROM transactions WHERE profile_id = $1",
        profile_id,
    )
    earliest = earliest_row["earliest"].date() if earliest_row["earliest"] else today
    return (today - earliest).days


async def _dismissed_filtered_charges(
    profile_id: int, conn: asyncpg.Connection, transactions: list[TransactionInput]
) -> list[RecurringCharge]:
    dismissed_rows = await conn.fetch(
        "SELECT group_key FROM dismissed_recurring_groups WHERE profile_id = $1",
        profile_id,
    )
    dismissed = {r["group_key"] for r in dismissed_rows}
    return [c for c in detect(transactions) if c.group_key not in dismissed]


async def _cash_balance(profile_id: int, conn: asyncpg.Connection) -> Decimal:
    balance_rows = await conn.fetch(
        """SELECT a.id,
                  COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'income'), 0)
                    - COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'), 0)
                    AS balance
           FROM accounts a
           LEFT JOIN transactions t ON t.account_id = a.id
           WHERE a.profile_id = $1 AND a.type = ANY($2::text[]) AND a.is_active
           GROUP BY a.id""",
        profile_id,
        list(CASH_ACCOUNT_TYPES),
    )
    return sum((r["balance"] for r in balance_rows), Decimal(0))


@router.get("/forecast", response_model=ForecastResponse)
async def cash_flow_forecast(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    transactions = await _fetch_recurring_input(profile.id, conn)
    today = datetime.now().date()
    history_span_days = await _history_span_days(profile.id, conn, today)
    charges = await _dismissed_filtered_charges(profile.id, conn, transactions)
    recurring_transaction_ids = {tid for c in charges for tid in c.transaction_ids}
    start_balance = await _cash_balance(profile.id, conn)

    discretionary_cutoff = today - timedelta(days=DISCRETIONARY_WINDOW_DAYS)
    discretionary_total = sum(
        (
            t["amount"]
            for t in transactions
            if t["transaction_type"] == "expense"
            and t["date"] >= discretionary_cutoff
            and t["id"] not in recurring_transaction_ids
        ),
        Decimal(0),
    )
    avg_daily_discretionary = discretionary_total / DISCRETIONARY_WINDOW_DAYS

    result = simulate(
        start_balance=start_balance,
        start_date=today,
        horizon_days=FORECAST_HORIZON_DAYS,
        recurring_charges=charges,
        avg_daily_discretionary=avg_daily_discretionary,
        history_span_days=history_span_days,
    )

    return ForecastResponse(
        insufficient_data=result.insufficient_data,
        message=result.message,
        days=[
            ForecastDayResponse(
                date=d.date, balance=float(d.balance), income=float(d.income), expenses=float(d.expenses)
            )
            for d in result.days
        ],
        crunch_points=result.crunch_points,
    )


@router.get("/safe-to-spend", response_model=SafeToSpendResponse)
async def safe_to_spend(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    transactions = await _fetch_recurring_input(profile.id, conn)
    today = datetime.now().date()
    history_span_days = await _history_span_days(profile.id, conn, today)
    charges = await _dismissed_filtered_charges(profile.id, conn, transactions)
    cash_balance = await _cash_balance(profile.id, conn)

    goal_rows = await conn.fetch(
        """SELECT monthly_contribution FROM goals
           WHERE profile_id = $1 AND is_active
             AND monthly_contribution IS NOT NULL
             AND current_amount < target_amount""",
        profile.id,
    )
    goal_contributions = [r["monthly_contribution"] for r in goal_rows]

    result = compute_safe_to_spend(
        cash_balance=cash_balance,
        recurring_charges=charges,
        goal_monthly_contributions=goal_contributions,
        reference_date=today,
        history_span_days=history_span_days,
    )

    return SafeToSpendResponse(
        insufficient_data=result.insufficient_data,
        message=result.message,
        safe_to_spend=float(result.safe_to_spend) if result.safe_to_spend is not None else None,
        cash_balance=float(result.cash_balance) if result.cash_balance is not None else None,
        next_payday=result.next_payday,
        days_until_payday=result.days_until_payday,
        bills_before_payday=float(result.bills_before_payday),
        goal_contributions_due=float(result.goal_contributions_due),
    )


@router.post("/recurring/dismiss", status_code=204)
async def dismiss_recurring_group(
    payload: DismissRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """"Not a subscription" — excludes this group from GET /recurring going forward,
    persisted per profile (I2). Idempotent: dismissing twice is a no-op, not an error."""
    await conn.execute(
        """INSERT INTO dismissed_recurring_groups (profile_id, group_key)
           VALUES ($1, $2)
           ON CONFLICT (profile_id, group_key) DO NOTHING""",
        profile.id,
        payload.group_key,
    )


async def _budget_statuses(profile_id: int, conn: asyncpg.Connection) -> list[BudgetStatus]:
    rows = await conn.fetch(
        """SELECT b.name, b.amount, b.period, c.name AS category_name
           FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
           WHERE b.profile_id = $1 AND b.is_active""",
        profile_id,
    )
    statuses = []
    period_ranges: dict[str, tuple[datetime, datetime]] = {}
    for r in rows:
        if r["period"] not in period_ranges:
            period_ranges[r["period"]] = get_period_range(r["period"])
        start, end = period_ranges[r["period"]]
        spent = await conn.fetchval(
            """SELECT COALESCE(SUM(amount), 0) FROM transactions
               WHERE profile_id = $1 AND transaction_type = 'expense'
                 AND date >= $2 AND date < $3""",
            profile_id,
            start,
            end,
        )
        statuses.append(
            BudgetStatus(
                label=r["category_name"] or r["name"],
                amount=r["amount"],
                spent=spent,
            )
        )
    return statuses


async def _goal_statuses(profile_id: int, conn: asyncpg.Connection) -> list[GoalStatus]:
    rows = await conn.fetch(
        """SELECT name, target_amount, current_amount, monthly_contribution, deadline, created_at
           FROM goals
           WHERE profile_id = $1 AND is_active AND current_amount < target_amount""",
        profile_id,
    )
    return [
        GoalStatus(
            name=r["name"],
            target_amount=r["target_amount"],
            current_amount=r["current_amount"],
            monthly_contribution=r["monthly_contribution"],
            deadline=r["deadline"].date() if r["deadline"] else None,
            created_at=r["created_at"].date(),
        )
        for r in rows
    ]


@router.get("/advice", response_model=list[AdviceCardResponse])
async def advice_cards(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    recurring_transactions = await _fetch_recurring_input(profile.id, conn)
    categorized_transactions = await _fetch_categorized_transactions(profile.id, conn)
    today = datetime.now().date()

    charges = await _dismissed_filtered_charges(profile.id, conn, recurring_transactions)
    trend_insights = detect_insights(categorized_transactions, today)
    budgets = await _budget_statuses(profile.id, conn)
    goals = await _goal_statuses(profile.id, conn)

    cards = generate_advice(charges, trend_insights, budgets, goals, today)

    dismissed_rows = await conn.fetch(
        "SELECT insight_type FROM dismissed_insight_types WHERE profile_id = $1",
        profile.id,
    )
    dismissed_types = {r["insight_type"] for r in dismissed_rows}
    cards = [c for c in cards if c.type not in dismissed_types]

    user_row = await conn.fetchrow(
        "SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id
    )
    cloud_enabled = bool(user_row["ai_cloud_enabled"])

    responses = []
    for c in cards:
        reworded = await rephrase(c.message, cloud_enabled)
        responses.append(
            AdviceCardResponse(
                type=c.type,
                message=reworded or c.message,
                evidence=c.evidence,
                ai_generated=reworded is not None,
            )
        )
    return responses


@router.post("/advice/dismiss", status_code=204)
async def dismiss_advice_type(
    payload: AdviceDismissRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Dismissing a card suppresses that insight *type* going forward, not just the
    one instance (design-system.md §4). Idempotent."""
    await conn.execute(
        """INSERT INTO dismissed_insight_types (profile_id, insight_type)
           VALUES ($1, $2)
           ON CONFLICT (profile_id, insight_type) DO NOTHING""",
        profile.id,
        payload.type,
    )
