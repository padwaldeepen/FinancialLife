from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Category, Transaction, User
from database.session import get_db
from routers.auth import get_current_user

router = APIRouter()


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


@router.get("/monthly", response_model=list[MonthlyEntry])
async def monthly_report(
    year: int = Query(default_factory=lambda: date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = []
    for m in range(1, 13):
        month_start = datetime(year, m, 1)
        if m == 12:
            month_end = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = datetime(year, m + 1, 1) - timedelta(days=1)

        income_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == current_user.id,
                Transaction.transaction_type == "income",
                Transaction.date >= month_start,
                Transaction.date <= month_end,
            )
        )
        income = income_result.scalar() or 0

        expense_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == current_user.id,
                Transaction.transaction_type == "expense",
                Transaction.date >= month_start,
                Transaction.date <= month_end,
            )
        )
        expense = expense_result.scalar() or 0

        results.append(
            MonthlyEntry(
                month=MONTH_NAMES[m - 1],
                income=round(income, 2),
                expense=round(expense, 2),
                net=round(income - expense, 2),
            )
        )

    return results


@router.get("/summary", response_model=SummaryResponse)
async def report_summary(
    days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.combine(date.today(), datetime.min.time()) - timedelta(days=days)

    income_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "income",
            Transaction.date >= cutoff,
        )
    )
    total_income = round(income_result.scalar() or 0, 2)

    expense_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
            Transaction.date >= cutoff,
        )
    )
    total_expense = round(expense_result.scalar() or 0, 2)

    count_result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == current_user.id,
            Transaction.date >= cutoff,
        )
    )
    tx_count = count_result.scalar() or 0

    avg_daily = round(total_expense / max(days, 1), 2)

    top_cat_result = await db.execute(
        select(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
            Transaction.category_id.isnot(None),
            Transaction.date >= cutoff,
        )
        .group_by(Transaction.category_id)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(1)
    )
    top_row = top_cat_result.first()
    top_category = None
    top_amount = None
    if top_row:
        cat_result = await db.execute(select(Category).where(Category.id == top_row.category_id))
        cat = cat_result.scalar_one_or_none()
        top_category = cat.name if cat else None
        top_amount = round(top_row.total, 2)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.combine(date.today(), datetime.min.time()) - timedelta(days=days)

    rows_result = await db.execute(
        select(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("tx_count"),
        )
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
            Transaction.category_id.isnot(None),
            Transaction.date >= cutoff,
        )
        .group_by(Transaction.category_id)
        .order_by(func.sum(Transaction.amount).desc())
    )
    rows = rows_result.all()

    grand_total = sum(r.total for r in rows) or 0

    result = []
    for r in rows:
        cat_result = await db.execute(select(Category).where(Category.id == r.category_id))
        cat = cat_result.scalar_one_or_none()
        result.append(
            CategoryTotal(
                category_id=r.category_id,
                category_name=cat.name if cat else "Unknown",
                category_color=cat.color if cat else "#6B7280",
                total=round(r.total, 2),
                percentage=round((r.total / grand_total * 100), 1) if grand_total > 0 else 0,
                transaction_count=r.tx_count,
            )
        )
    return result


async def _get_period_totals(
    db: AsyncSession,
    user_id: int,
    start: datetime,
    end: datetime,
) -> tuple[float, float]:
    income_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == "income",
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    income = round(income_result.scalar() or 0, 2)

    expense_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    expense = round(expense_result.scalar() or 0, 2)
    return income, expense


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / abs(previous)) * 100, 1)


@router.get("/comparison", response_model=ComparisonEntry)
async def report_comparison(
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cur_start = datetime(year, month, 1)
    if month == 12:
        cur_end = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        cur_end = datetime(year, month + 1, 1) - timedelta(days=1)

    prev_month = month - 1
    prev_year = year
    if prev_month == 0:
        prev_month = 12
        prev_year -= 1
    prev_start = datetime(prev_year, prev_month, 1)
    if prev_month == 12:
        prev_end = datetime(prev_year + 1, 1, 1) - timedelta(days=1)
    else:
        prev_end = datetime(prev_year, prev_month + 1, 1) - timedelta(days=1)

    cur_income, cur_expense = await _get_period_totals(db, current_user.id, cur_start, cur_end)
    prev_income, prev_expense = await _get_period_totals(db, current_user.id, prev_start, prev_end)

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
