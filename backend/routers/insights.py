import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.money import Money
from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from routers.budgets import get_period_range
from services import bill_service
from services.account_service import BALANCE_DELTAS
from services.ai.consent import cloud_enabled
from services.ai.rephrase import rephrase
from services.insights.advice import (
    BudgetStatus,
    FeeLeakage,
    GoalStatus,
    RemittanceSummary,
    SavingsSnapshot,
)
from services.insights.advice import generate as generate_advice
from services.insights.forecast import ForecastResult, simulate
from services.insights.recurring import RecurringCharge, TransactionInput, detect
from services.insights.safe_to_spend import compute as compute_safe_to_spend
from services.insights.trends import CategorizedTransaction, category_trends, detect_insights
from services.transaction_service import spent_in_period

router = APIRouter()

# Y3: how far ahead a bill counts as "needs attention". A week is long enough to act on
# (move money, cancel something) and short enough that the block isn't permanently full.
ATTENTION_BILL_WINDOW_DAYS = 7

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
    monthly_equivalent: Money
    next_expected_date: date
    occurrence_count: int
    confidence: float
    transaction_ids: list[int]


class DismissRequest(BaseModel):
    group_key: str


class CategoryTrendResponse(BaseModel):
    category_id: int | None
    category_name: str
    current_month_total: Money
    previous_month_total: Money | None
    mom_change_pct: float | None
    same_month_last_year_total: Money | None
    yoy_change_pct: float | None


class InsightResponse(BaseModel):
    type: str
    category_id: int | None
    category_name: str
    message: str
    evidence: dict


class ForecastDayResponse(BaseModel):
    date: date
    balance: Money
    income: Money
    expenses: Money


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


class AttentionItemResponse(BaseModel):
    """Y3. Same shape as an advice card on purpose — type + human message + the numbers
    backing it — so the UI reuses the existing evidence/dismiss card rather than
    inventing a second alert concept."""

    type: str
    severity: Literal["urgent", "warning", "info"]
    message: str
    evidence: dict
    action_path: str | None = None


class SafeToSpendResponse(BaseModel):
    insufficient_data: bool
    message: str | None
    safe_to_spend: Money | None
    cash_balance: Money | None
    next_payday: date | None
    days_until_payday: int | None
    bills_before_payday: Money
    goal_contributions_due: Money


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
    """Spendable cash across the profile's active cash accounts.

    Uses the shared `BALANCE_DELTAS` definition rather than its own income-minus-expense
    sum. The old version counted only `income`/`expense` rows, so a **transfer** moved no
    money at all here: paying a credit card or moving cash into an investment left this
    total unchanged while the accounts list correctly showed it gone. Safe-to-spend is
    built on this number, so it was telling you that you could spend money you had
    already moved out.
    """
    total = await conn.fetchval(
        f"""SELECT COALESCE(SUM(d.delta), 0)
              FROM ({BALANCE_DELTAS.format(out_scope="profile_id = $1", in_scope="profile_id = $1")}) d
              JOIN accounts a ON a.id = d.account_id
             WHERE a.type = ANY($2::text[]) AND a.is_active""",
        profile_id,
        list(CASH_ACCOUNT_TYPES),
    )
    return total


# Y3 reuses the cash-flow forecast for its "projected shortfall" alert, so the setup
# that feeds `simulate()` lives here rather than inline in the endpoint — duplicating it
# would mean the Home alert and the Insights chart could silently disagree about whether
# you are heading for a crunch.
async def _compute_forecast(profile_id: int, conn: asyncpg.Connection) -> ForecastResult:
    transactions = await _fetch_recurring_input(profile_id, conn)
    today = datetime.now().date()
    history_span_days = await _history_span_days(profile_id, conn, today)
    charges = await _dismissed_filtered_charges(profile_id, conn, transactions)
    recurring_transaction_ids = {tid for c in charges for tid in c.transaction_ids}
    start_balance = await _cash_balance(profile_id, conn)

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

    return simulate(
        start_balance=start_balance,
        start_date=today,
        horizon_days=FORECAST_HORIZON_DAYS,
        recurring_charges=charges,
        avg_daily_discretionary=avg_daily_discretionary,
        history_span_days=history_span_days,
    )


@router.get("/forecast", response_model=ForecastResponse)
async def cash_flow_forecast(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    result = await _compute_forecast(profile.id, conn)

    return ForecastResponse(
        insufficient_data=result.insufficient_data,
        message=result.message,
        days=[
            ForecastDayResponse(
                date=d.date,
                balance=d.balance,
                income=d.income,
                expenses=d.expenses,
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
        cash_balance=result.cash_balance,
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
    """ "Not a subscription" — excludes this group from GET /recurring going forward,
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
        """SELECT b.name, b.amount, b.period, b.category_id, c.name AS category_name
           FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
           WHERE b.profile_id = $1 AND b.is_active""",
        profile_id,
    )
    statuses = []
    period_ranges: dict[str, tuple[datetime, datetime]] = {}
    # R4(c): "spent" now comes from the one shared definition, and is memoized per
    # distinct period rather than re-queried per budget. Ten monthly budgets used to
    # mean ten identical round-trips for the same number.
    # Keyed by (period, category) because "spent" is category-scoped — two budgets on
    # the same period but different categories are different numbers.
    spent_by_key: dict[tuple[str, int | None], Decimal] = {}
    for r in rows:
        period = r["period"]
        if period not in period_ranges:
            period_ranges[period] = get_period_range(period)
        start, end = period_ranges[period]
        key = (period, r["category_id"])
        if key not in spent_by_key:
            spent_by_key[key] = await spent_in_period(
                profile_id, start, end, conn, r["category_id"]
            )
        spent = spent_by_key[key]
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


# Fees/interest a user pays for nothing — the honest, detectable "useless spend" (N2).
# Matched on description since there's no dedicated Fees category in the seed tree.
_FEE_KEYWORDS = (
    "interest",
    "finance charge",
    "late fee",
    "overdraft",
    "atm fee",
    "service charge",
    "annual fee",
    "foreign transaction fee",
    "maintenance fee",
    "nsf fee",
)
_ADVICE_WINDOW_DAYS = 90


def _current_month_start(today: date) -> date:
    return today.replace(day=1)


async def _savings_snapshot(
    profile_id: int, conn: asyncpg.Connection, today: date
) -> SavingsSnapshot:
    month_start = _current_month_start(today)
    row = await conn.fetchrow(
        """SELECT
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) AS income,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0) AS expense
           FROM transactions WHERE profile_id = $1 AND date >= $2""",
        profile_id,
        month_start,
    )
    return SavingsSnapshot(income=row["income"], expense=row["expense"], period_label="this month")


async def _fee_leakage(profile_id: int, conn: asyncpg.Connection, today: date) -> FeeLeakage:
    cutoff = today - timedelta(days=_ADVICE_WINDOW_DAYS)
    row = await conn.fetchrow(
        """SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
           FROM transactions
           WHERE profile_id = $1 AND transaction_type = 'expense' AND date >= $2
             AND description ILIKE ANY($3::text[])""",
        profile_id,
        cutoff,
        [f"%{kw}%" for kw in _FEE_KEYWORDS],
    )
    return FeeLeakage(total=row["total"], count=row["count"], period_label="in the last 90 days")


async def _remittance_summary(
    profile_id: int, conn: asyncpg.Connection, today: date
) -> RemittanceSummary:
    month_start = _current_month_start(today)
    total = await conn.fetchval(
        """SELECT COALESCE(SUM(t.amount), 0)
           FROM transactions t JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.date >= $2 AND c.name = 'Money Sent Home'""",
        profile_id,
        month_start,
    )
    return RemittanceSummary(total=total, period_label="this month")


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
    savings = await _savings_snapshot(profile.id, conn, today)
    fees = await _fee_leakage(profile.id, conn, today)
    remittance = await _remittance_summary(profile.id, conn, today)

    cards = generate_advice(
        charges, trend_insights, budgets, goals, today, savings, fees, remittance
    )

    dismissed_rows = await conn.fetch(
        "SELECT insight_type FROM dismissed_insight_types WHERE profile_id = $1",
        profile.id,
    )
    dismissed_types = {r["insight_type"] for r in dismissed_rows}
    cards = [c for c in cards if c.type not in dismissed_types]

    ai_enabled = await cloud_enabled(profile, conn)

    # Gemini rephrase is pure HTTP with a 10s timeout and touches no shared DB
    # connection, so these are safe to run concurrently. Sequentially, six advice cards
    # with the cloud toggle on could take a minute before the page showed anything.
    rewordings = await asyncio.gather(*(rephrase(c.message, ai_enabled) for c in cards))

    responses = []
    for c, reworded in zip(cards, rewordings, strict=True):
        responses.append(
            AdviceCardResponse(
                type=c.type,
                message=reworded or c.message,
                evidence=c.evidence,
                ai_generated=reworded is not None,
            )
        )
    return responses


@router.get("/needs-attention", response_model=list[AttentionItemResponse])
async def needs_attention(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Y3: the four things worth interrupting someone for, on Home.

    The app already computed all of this — forecast, recurring bills, spend anomalies,
    the review queue — and then never told anyone; you had to go looking. Deliberately
    **no push infrastructure**: this is localhost-only, so notifications would be a
    rabbit hole. It is an in-app block, and a healthy profile returns `[]` so Home shows
    nothing at all rather than an empty "no alerts" card.

    Every item is derived from an existing engine — nothing new is computed here — and
    is suppressible through the same `dismissed_insight_types` table the advice cards
    use, so "stop telling me this" means the same thing everywhere.
    """
    today = datetime.now().date()
    items: list[AttentionItemResponse] = []

    # 1. Bills due soon and not yet paid.
    # Same two calls /bills/upcoming makes — a hand-rolled SELECT here missed a column
    # the helper needs and 500'd, which is the argument for reusing the getter.
    bills = await bill_service.get_bills(profile.id, conn)
    upcoming = await bill_service.compute_upcoming_async(bills, ATTENTION_BILL_WINDOW_DAYS, conn)
    unpaid = [b for b in upcoming if not b["has_paid"]]
    if unpaid:
        total = sum((Decimal(str(b["amount"])) for b in unpaid), Decimal(0))
        soonest = min(unpaid, key=lambda b: b["days_until"])
        days_away = soonest["days_until"]
        items.append(
            AttentionItemResponse(
                type="bills_due_soon",
                severity="urgent" if days_away <= 2 else "warning",
                message=(
                    f"{len(unpaid)} bill{'s' if len(unpaid) != 1 else ''} due "
                    f"in the next {ATTENTION_BILL_WINDOW_DAYS} days"
                ),
                evidence={
                    "count": len(unpaid),
                    "total": float(total),
                    "soonest_due": soonest["next_due"],
                    "soonest_name": soonest["name"],
                    "days_away": days_away,
                },
                action_path="/recurring",
            )
        )

    # 2. Projected shortfall — the forecast's own crunch points, not a second model.
    forecast = await _compute_forecast(profile.id, conn)
    if not forecast.insufficient_data and forecast.crunch_points:
        first = forecast.crunch_points[0]
        items.append(
            AttentionItemResponse(
                type="projected_shortfall",
                severity="urgent",
                message=f"Balance is projected to run low around {first.strftime('%b %d')}",
                evidence={
                    "first_crunch_date": first.isoformat(),
                    "crunch_day_count": len(forecast.crunch_points),
                    "days_away": (first - today).days,
                },
                action_path="/insights",
            )
        )

    # 3. Category spend anomalies (I3), reusing the same detector the advice cards use.
    # `type` is the bare "anomaly", matching the advice card for the same insight — not
    # a per-category key. Dismissal is by type and shared with the advice feed, so a
    # distinct key here would mean "stop telling me this" had to be clicked twice and
    # meant different things in two places. Only the first is shown: this block is a
    # short list of what to act on, not a full feed.
    categorized = await _fetch_categorized_transactions(profile.id, conn)
    anomalies = [i for i in detect_insights(categorized, today) if i.type == "anomaly"]
    if anomalies:
        top = anomalies[0]
        items.append(
            AttentionItemResponse(
                type=top.type,
                severity="warning",
                message=top.message,
                evidence=top.evidence,
                action_path="/activity",
            )
        )

    # 4. Documents still waiting to be turned into transactions (X1).
    pending_count = await conn.fetchval(
        "SELECT COUNT(*) FROM documents WHERE profile_id = $1 AND status = 'pending'",
        profile.id,
    )
    if pending_count:
        items.append(
            AttentionItemResponse(
                type="pending_documents",
                severity="info",
                message=(
                    f"{pending_count} document{'s' if pending_count != 1 else ''} "
                    "waiting for review"
                ),
                evidence={"count": pending_count},
                action_path="/activity",
            )
        )

    dismissed_rows = await conn.fetch(
        "SELECT insight_type FROM dismissed_insight_types WHERE profile_id = $1",
        profile.id,
    )
    dismissed = {r["insight_type"] for r in dismissed_rows}
    items = [i for i in items if i.type not in dismissed]

    # Most actionable first; the UI shows them in order and caps the list.
    order = {"urgent": 0, "warning": 1, "info": 2}
    items.sort(key=lambda i: order[i.severity])
    return items


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


# --- Y2: net worth over time ----------------------------------------------------------

# Which account types count as assets. Anything else (today: 'credit') is a liability.
# Kept in step with the frontend's CASH_TYPES in useHomeData.ts — 'investment' is an
# asset here even though it isn't spendable cash, because net worth asks what you OWN,
# not what you can spend today (that's safe-to-spend's job).
_ASSET_TYPES = ("checking", "savings", "cash", "investment")

# Net worth needs enough history to be a trend rather than a single dot. Below this the
# endpoint reports insufficient_data instead of drawing a misleading two-point "trend" —
# same honesty gate as I3/I4.
_MIN_MONTHS_FOR_TREND = 3


class NetWorthPoint(BaseModel):
    month: str  # YYYY-MM
    assets: Money
    liabilities: Money
    net_worth: Money


class NetWorthResponse(BaseModel):
    points: list[NetWorthPoint]
    insufficient_data: bool
    months_available: int


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Y2: month-end net worth for THIS profile, derived from transaction history.

    Derived rather than snapshotted: there is no balance-history table, and computing a
    running total from the ledger gives a correct series for months that already happened
    without needing a scheduled job that would only start collecting data from today.

    **Per profile, never blended.** A profile is a sealed single-currency world, so a US
    trendline and an India trendline are two separate series and are never summed — there
    is no conversion anywhere in this codebase.

    Liabilities are reported as a positive number (what you owe). A credit account's
    balance goes negative as debt accrues (charges are 'expense', payments are 'income'),
    so it is negated here — the same correction the Home screen makes for "Credit owed".
    """
    rows = await conn.fetch(
        f"""
        WITH months AS (
            SELECT generate_series(
                       date_trunc('month', COALESCE(MIN(t.date), NOW())),
                       date_trunc('month', NOW()),
                       interval '1 month'
                   ) AS m
              FROM transactions t
             WHERE t.profile_id = $1
        ),
        -- The shared definition of a balance delta (income adds, everything else
        -- subtracts, a transfer's incoming leg is a second row) — imported rather than
        -- restated, so this trendline can never disagree with the accounts list.
        deltas AS ({BALANCE_DELTAS.format(out_scope="profile_id = $1", in_scope="profile_id = $1")}),
        -- Collapse to one row per month FIRST. Joining months to deltas directly is a
        -- non-equi join (`d.date < month_end`), so every month re-scans all prior
        -- transactions: 60 months x 30k rows is ~1.8M intermediate rows, and it grows
        -- quadratically as history accumulates — precisely the direction a net-worth
        -- trend goes. Aggregating per month and then running-summing is one pass.
        monthly AS (
            SELECT date_trunc('month', d.date) AS m,
                   SUM(d.delta) FILTER (WHERE a.type = ANY($2::text[])) AS assets_delta,
                   SUM(d.delta) FILTER (WHERE a.type <> ALL($2::text[])) AS liabilities_delta
              FROM deltas d
              JOIN accounts a ON a.id = d.account_id
             GROUP BY 1
        )
        SELECT to_char(months.m, 'YYYY-MM') AS month,
               COALESCE(
                   SUM(COALESCE(monthly.assets_delta, 0)) OVER (ORDER BY months.m), 0
               ) AS assets,
               COALESCE(
                   SUM(COALESCE(monthly.liabilities_delta, 0)) OVER (ORDER BY months.m), 0
               ) AS liabilities
          FROM months
          LEFT JOIN monthly ON monthly.m = months.m
         ORDER BY months.m
        """,
        profile.id,
        list(_ASSET_TYPES),
    )

    points = [
        NetWorthPoint(
            month=r["month"],
            assets=r["assets"],
            # Negated so "liabilities" reads as the positive amount owed.
            liabilities=-r["liabilities"],
            net_worth=r["assets"] + r["liabilities"],
        )
        for r in rows
    ]
    return NetWorthResponse(
        points=points,
        insufficient_data=len(points) < _MIN_MONTHS_FOR_TREND,
        months_available=len(points),
    )
