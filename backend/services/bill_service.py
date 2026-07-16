from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.logging import get_logger
from database.models import Bill, Transaction, TransactionBillLink

log = get_logger(__name__)


async def get_bills(user_id: int, db: AsyncSession) -> list[Bill]:
    result = await db.execute(
        select(Bill)
        .options(joinedload(Bill.category), joinedload(Bill.account), joinedload(Bill.merchant))
        .where(Bill.user_id == user_id, Bill.is_active)
        .order_by(Bill.due_day, Bill.name)
    )
    return result.unique().scalars().all()


async def get_bill(bill_id: int, user_id: int, db: AsyncSession) -> Bill | None:
    result = await db.execute(
        select(Bill)
        .options(joinedload(Bill.category), joinedload(Bill.account), joinedload(Bill.merchant))
        .where(Bill.id == bill_id, Bill.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_bill(
    db: AsyncSession,
    user_id: int,
    name: str,
    amount: float,
    frequency: str,
    due_day: int,
    account_id: int,
    category_id: int | None = None,
    merchant_id: int | None = None,
    amount_estimated: float | None = None,
    is_variable: bool = False,
    notes: str | None = None,
) -> Bill:
    bill = Bill(
        user_id=user_id,
        name=name,
        amount=amount,
        amount_estimated=amount_estimated,
        frequency=frequency,
        due_day=due_day,
        category_id=category_id,
        merchant_id=merchant_id,
        account_id=account_id,
        is_active=True,
        is_variable=is_variable,
        notes=notes,
    )
    db.add(bill)
    await db.flush()
    await db.refresh(bill)
    result = await db.execute(
        select(Bill)
        .options(joinedload(Bill.category), joinedload(Bill.account), joinedload(Bill.merchant))
        .where(Bill.id == bill.id)
    )
    return result.unique().scalar_one()


async def update_bill(bill_id: int, user_id: int, data: dict, db: AsyncSession) -> Bill | None:
    bill = await get_bill(bill_id, user_id, db)
    if not bill:
        return None
    for field, value in data.items():
        setattr(bill, field, value)
    await db.flush()
    result = await db.execute(
        select(Bill)
        .options(joinedload(Bill.category), joinedload(Bill.account), joinedload(Bill.merchant))
        .where(Bill.id == bill.id)
    )
    return result.unique().scalar_one_or_none()


async def delete_bill(bill_id: int, user_id: int, db: AsyncSession) -> bool:
    bill = await get_bill(bill_id, user_id, db)
    if not bill:
        return False
    await db.delete(bill)
    await db.flush()
    return True


async def get_bill_history(bill_id: int, user_id: int, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(
            Transaction.bill_id == bill_id,
            Transaction.user_id == user_id,
        )
        .order_by(Transaction.date.desc())
    )
    txs = result.scalars().all()

    monthly_result = await db.execute(
        select(
            func.date_trunc("month", Transaction.date),
            func.sum(Transaction.amount),
        )
        .where(
            Transaction.bill_id == bill_id,
            Transaction.user_id == user_id,
            Transaction.transaction_type == "expense",
        )
        .group_by(func.date_trunc("month", Transaction.date))
        .order_by(func.date_trunc("month", Transaction.date))
    )
    monthly_chart = [
        {"month": row[0].strftime("%Y-%m"), "amount": float(row[1])} for row in monthly_result.all()
    ]

    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "description": t.description,
                "date": t.date.isoformat(),
                "category_name": t.category.name if t.category else None,
            }
            for t in txs
        ],
        "monthly_spending": monthly_chart,
    }


async def suggest_bill_match(
    user_id: int,
    description: str,
    amount: float,
    date: datetime,
    merchant_id: int | None,
    db: AsyncSession,
) -> Bill | None:
    """Find a bill that likely matches this transaction."""
    bills = await get_bills(user_id, db)
    today = date.date()

    for bill in bills:
        if bill.merchant_id and bill.merchant_id == merchant_id:
            next_due = _next_due_date(bill.due_day, bill.frequency)
            days_diff = abs((next_due - today).days)
            if days_diff <= 5:
                amount_diff = abs(bill.amount - amount)
                if amount_diff <= bill.amount * 0.2:
                    return bill

    for bill in bills:
        desc_lower = description.lower()
        bill_lower = bill.name.lower()
        if bill_lower in desc_lower or desc_lower in bill_lower:
            next_due = _next_due_date(bill.due_day, bill.frequency)
            days_diff = abs((next_due - today).days)
            if days_diff <= 7:
                return bill

    return None


async def auto_link_transaction(
    transaction_id: int,
    bill_id: int,
    db: AsyncSession,
    is_auto: bool = True,
) -> TransactionBillLink | None:
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        return None

    next_due = _next_due_date(bill.due_day, bill.frequency)
    period_start = next_due - timedelta(days=30)
    period_end = next_due + timedelta(days=1)

    link = TransactionBillLink(
        transaction_id=transaction_id,
        bill_id=bill_id,
        period_start=datetime.combine(period_start, datetime.min.time()),
        period_end=datetime.combine(period_end, datetime.min.time()),
        is_auto_linked=is_auto,
    )
    db.add(link)
    await db.flush()
    return link


def _next_due_date(due_day: int, frequency: str) -> date:
    """Calculate the next due date based on frequency and due_day."""
    today = date.today()
    current_year = today.year
    current_month = today.month

    if frequency == "monthly":
        try:
            next_due = date(current_year, current_month, due_day)
        except ValueError:
            next_due = date(current_year, current_month + 1, 1) - timedelta(days=1)
        if next_due <= today:
            next_month = current_month + 1
            next_year = current_year
            if next_month > 12:
                next_month = 1
                next_year += 1
            try:
                next_due = date(next_year, next_month, due_day)
            except ValueError:
                next_due = date(next_year, next_month + 1, 1) - timedelta(days=1)
        return next_due

    if frequency == "weekly":
        days_ahead = due_day - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return today + timedelta(days=days_ahead)

    if frequency == "biweekly":
        days_ahead = due_day - (today.weekday() % 14)
        if days_ahead <= 0:
            days_ahead += 14
        return today + timedelta(days=days_ahead)

    if frequency == "quarterly":
        quarter_month = ((current_month - 1) // 3) * 3 + 1
        try:
            next_due = date(current_year, quarter_month, due_day)
        except ValueError:
            next_due = date(current_year, quarter_month + 1, 1) - timedelta(days=1)
        if next_due <= today:
            quarter_month += 3
            if quarter_month > 12:
                quarter_month = 1
                current_year += 1
            try:
                next_due = date(current_year, quarter_month, due_day)
            except ValueError:
                next_due = date(current_year, quarter_month + 1, 1) - timedelta(days=1)
        return next_due

    if frequency == "yearly":
        try:
            next_due = date(current_year, 1, due_day)
        except ValueError:
            next_due = date(current_year, 2, 1) - timedelta(days=1)
        if next_due <= today:
            next_year = current_year + 1
            try:
                next_due = date(next_year, 1, due_day)
            except ValueError:
                next_due = date(next_year, 2, 1) - timedelta(days=1)
        return next_due

    return today + timedelta(days=30)


def compute_upcoming(
    bills: list[Bill],
    days: int = 7,
    db: AsyncSession | None = None,  # noqa: ARG001
) -> list[dict]:
    """Compute upcoming bills within the next N days, checking for paid status.

    NOTE: db must be provided to check paid status. If db is None, has_paid defaults to False.
    The caller should use compute_upcoming_async for proper async db access.
    """
    today = date.today()
    cutoff = today + timedelta(days=days)
    upcoming: list[dict] = []

    for bill in bills:
        next_due = _next_due_date(bill.due_day, bill.frequency)
        if today <= next_due <= cutoff:
            category_name = bill.category.name if bill.category else None
            account_name = bill.account.name if bill.account else None
            merchant_name = bill.merchant.name if bill.merchant else None

            upcoming.append(
                {
                    "id": bill.id,
                    "name": bill.name,
                    "amount": float(bill.amount),
                    "amount_estimated": float(bill.amount_estimated)
                    if bill.amount_estimated
                    else None,
                    "frequency": bill.frequency,
                    "due_day": bill.due_day,
                    "next_due": next_due.isoformat(),
                    "days_until": (next_due - today).days,
                    "category_name": category_name,
                    "account_name": account_name,
                    "merchant_name": merchant_name,
                    "is_variable": bill.is_variable,
                    "has_paid": False,
                }
            )

    upcoming.sort(key=lambda b: b["days_until"])
    return upcoming


async def compute_upcoming_async(
    bills: list[Bill], days: int = 7, db: AsyncSession | None = None
) -> list[dict]:
    """Async version of compute_upcoming that properly checks paid status."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    upcoming: list[dict] = []

    for bill in bills:
        next_due = _next_due_date(bill.due_day, bill.frequency)
        if today <= next_due <= cutoff:
            category_name = bill.category.name if bill.category else None
            account_name = bill.account.name if bill.account else None
            merchant_name = bill.merchant.name if bill.merchant else None

            has_paid = False
            if db is not None:
                paid_result = await db.execute(
                    select(TransactionBillLink).where(
                        TransactionBillLink.bill_id == bill.id,
                        TransactionBillLink.period_start
                        <= datetime.combine(today, datetime.min.time()),
                        TransactionBillLink.period_end
                        >= datetime.combine(today, datetime.min.time()),
                    )
                )
                has_paid = paid_result.scalar_one_or_none() is not None

            upcoming.append(
                {
                    "id": bill.id,
                    "name": bill.name,
                    "amount": float(bill.amount),
                    "amount_estimated": float(bill.amount_estimated)
                    if bill.amount_estimated
                    else None,
                    "frequency": bill.frequency,
                    "due_day": bill.due_day,
                    "next_due": next_due.isoformat(),
                    "days_until": (next_due - today).days,
                    "category_name": category_name,
                    "account_name": account_name,
                    "merchant_name": merchant_name,
                    "is_variable": bill.is_variable,
                    "has_paid": has_paid,
                }
            )

    upcoming.sort(key=lambda b: b["days_until"])
    return upcoming
