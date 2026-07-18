from datetime import date, datetime, timedelta
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile

router = APIRouter()


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    end = (datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)) - timedelta(
        days=1
    )
    return start, end


class ComparisonEntry(BaseModel):
    label: str
    current_income: float
    current_expense: float
    current_net: float
    previous_income: float
    previous_expense: float
    previous_net: float
    income_change_pct: float | None
    expense_change_pct: float | None
    net_change_pct: float | None


class MonthlyEntry(BaseModel):
    month: str
    income: float
    expense: float
    net: float


class SummaryResponse(BaseModel):
    total_income: float
    total_expense: float
    net: float
    transaction_count: int
    avg_daily_expense: float
    top_category: str | None
    top_category_amount: float | None


class CategoryTotal(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    total: float
    percentage: float
    transaction_count: int


class MerchantTotal(BaseModel):
    merchant_id: int
    merchant_name: str
    total: float
    percentage: float
    transaction_count: int


MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


async def _period_totals(
    profile_id: int, start: datetime, end: datetime, conn: asyncpg.Connection
) -> tuple[float, float]:
    income = await conn.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM transactions
           WHERE profile_id = $1 AND transaction_type = 'income' AND date >= $2 AND date <= $3""",
        profile_id,
        start,
        end,
    )
    expense = await conn.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM transactions
           WHERE profile_id = $1 AND transaction_type = 'expense' AND date >= $2 AND date <= $3""",
        profile_id,
        start,
        end,
    )
    return round(float(income), 2), round(float(expense), 2)


@router.get("/monthly", response_model=list[MonthlyEntry])
async def monthly_report(
    year: int = Query(default_factory=lambda: date.today().year),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    results = []
    for m in range(1, 13):
        month_start, month_end = _month_bounds(year, m)
        income, expense = await _period_totals(profile.id, month_start, month_end, conn)
        results.append(
            MonthlyEntry(
                month=MONTH_NAMES[m - 1],
                income=income,
                expense=expense,
                net=round(income - expense, 2),
            )
        )
    return results


@router.get("/summary", response_model=SummaryResponse)
async def report_summary(
    days: int = Query(30),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    cutoff = datetime.combine(date.today(), datetime.min.time()) - timedelta(days=days)

    total_income = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'income' AND date >= $2""",
                profile.id,
                cutoff,
            )
        ),
        2,
    )
    total_expense = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'expense' AND date >= $2""",
                profile.id,
                cutoff,
            )
        ),
        2,
    )
    tx_count = await conn.fetchval(
        "SELECT COUNT(*) FROM transactions WHERE profile_id = $1 AND date >= $2",
        profile.id,
        cutoff,
    )
    avg_daily = round(total_expense / max(days, 1), 2)

    top_row = await conn.fetchrow(
        """SELECT t.category_id, c.name AS category_name, SUM(t.amount) AS total
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.category_id IS NOT NULL AND t.date >= $2
           GROUP BY t.category_id, c.name
           ORDER BY SUM(t.amount) DESC LIMIT 1""",
        profile.id,
        cutoff,
    )
    top_category = top_row["category_name"] if top_row else None
    top_amount = round(float(top_row["total"]), 2) if top_row else None

    return SummaryResponse(
        total_income=total_income,
        total_expense=total_expense,
        net=round(total_income - total_expense, 2),
        transaction_count=tx_count,
        avg_daily_expense=avg_daily,
        top_category=top_category,
        top_category_amount=top_amount,
    )


@router.get("/categories", response_model=list[CategoryTotal])
async def report_categories(
    days: int = Query(90),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    # A specific calendar month (Insights' period selector, and the per-month breakdown
    # the interactive timeline shows on hover — U6) takes precedence over the rolling
    # `days` window when given; `days` stays the default for existing callers (U4's
    # nothing uses this, but keep it backward compatible regardless).
    if year is not None and month is not None:
        start, end = _month_bounds(year, month)
    else:
        start = datetime.combine(date.today(), datetime.min.time()) - timedelta(days=days)
        end = datetime.combine(date.today(), datetime.max.time())

    rows = await conn.fetch(
        """SELECT t.category_id, c.name AS category_name, c.color AS category_color,
                  SUM(t.amount) AS total, COUNT(t.id) AS tx_count
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.category_id IS NOT NULL AND t.date >= $2 AND t.date <= $3
           GROUP BY t.category_id, c.name, c.color
           ORDER BY SUM(t.amount) DESC""",
        profile.id,
        start,
        end,
    )

    grand_total = sum(float(r["total"]) for r in rows) or 0
    return [
        CategoryTotal(
            category_id=r["category_id"],
            category_name=r["category_name"] or "Unknown",
            category_color=r["category_color"] or "#6B7280",
            total=round(float(r["total"]), 2),
            percentage=round((float(r["total"]) / grand_total * 100), 1) if grand_total > 0 else 0,
            transaction_count=r["tx_count"],
        )
        for r in rows
    ]


@router.get("/merchants", response_model=list[MerchantTotal])
async def report_merchants(
    days: int = Query(90),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Same shape/period-scoping as /categories, grouped by merchant instead — the
    Insights merchant-breakdown bar chart's data source (U6)."""
    if year is not None and month is not None:
        start, end = _month_bounds(year, month)
    else:
        start = datetime.combine(date.today(), datetime.min.time()) - timedelta(days=days)
        end = datetime.combine(date.today(), datetime.max.time())

    rows = await conn.fetch(
        """SELECT t.merchant_id, m.name AS merchant_name,
                  SUM(t.amount) AS total, COUNT(t.id) AS tx_count
           FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.merchant_id IS NOT NULL AND t.date >= $2 AND t.date <= $3
           GROUP BY t.merchant_id, m.name
           ORDER BY SUM(t.amount) DESC""",
        profile.id,
        start,
        end,
    )

    grand_total = sum(float(r["total"]) for r in rows) or 0
    return [
        MerchantTotal(
            merchant_id=r["merchant_id"],
            merchant_name=r["merchant_name"] or "Unknown",
            total=round(float(r["total"]), 2),
            percentage=round((float(r["total"]) / grand_total * 100), 1) if grand_total > 0 else 0,
            transaction_count=r["tx_count"],
        )
        for r in rows
    ]


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / abs(previous)) * 100, 1)


@router.get("/comparison", response_model=ComparisonEntry)
async def report_comparison(
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    mode: Literal["mom", "yoy"] = Query(default="mom"),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    cur_start, cur_end = _month_bounds(year, month)

    if mode == "yoy":
        prev_month, prev_year = month, year - 1
    else:
        prev_month, prev_year = month - 1, year
        if prev_month == 0:
            prev_month, prev_year = 12, year - 1
    prev_start, prev_end = _month_bounds(prev_year, prev_month)

    cur_income, cur_expense = await _period_totals(profile.id, cur_start, cur_end, conn)
    prev_income, prev_expense = await _period_totals(profile.id, prev_start, prev_end, conn)

    cur_net = round(cur_income - cur_expense, 2)
    prev_net = round(prev_income - prev_expense, 2)

    label = f"{MONTH_NAMES[month - 1]} {year} vs {MONTH_NAMES[prev_month - 1]} {prev_year}"

    return ComparisonEntry(
        label=label,
        current_income=cur_income,
        current_expense=cur_expense,
        current_net=cur_net,
        previous_income=prev_income,
        previous_expense=prev_expense,
        previous_net=prev_net,
        income_change_pct=_pct_change(cur_income, prev_income),
        expense_change_pct=_pct_change(cur_expense, prev_expense),
        net_change_pct=_pct_change(cur_net, prev_net),
    )
