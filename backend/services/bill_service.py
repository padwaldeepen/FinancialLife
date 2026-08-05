from datetime import date, datetime, timedelta
from decimal import Decimal

import asyncpg

from core.logging import get_logger

log = get_logger(__name__)

_BILL_JOIN = """
    SELECT b.*, c.name AS category_name, c.color AS category_color,
           m.name AS merchant_name, a.name AS account_name
    FROM bills b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN merchants m ON m.id = b.merchant_id
    LEFT JOIN accounts a ON a.id = b.account_id
"""


async def get_bills(profile_id: int, conn: asyncpg.Connection) -> list[dict]:
    rows = await conn.fetch(
        _BILL_JOIN + " WHERE b.profile_id = $1 AND b.is_active ORDER BY b.due_day, b.name",
        profile_id,
    )
    return [dict(r) for r in rows]


async def get_bill(bill_id: int, profile_id: int, conn: asyncpg.Connection) -> dict | None:
    row = await conn.fetchrow(
        _BILL_JOIN + " WHERE b.id = $1 AND b.profile_id = $2",
        bill_id,
        profile_id,
    )
    return dict(row) if row else None


async def create_bill(
    conn: asyncpg.Connection,
    profile_id: int,
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
) -> dict:
    bill_id = await conn.fetchval(
        """INSERT INTO bills
             (profile_id, name, amount, amount_estimated, frequency, due_day,
              category_id, merchant_id, account_id, is_active, is_variable, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11)
           RETURNING id""",
        profile_id,
        name,
        amount,
        amount_estimated,
        frequency,
        due_day,
        category_id,
        merchant_id,
        account_id,
        is_variable,
        notes,
    )
    return await get_bill(bill_id, profile_id, conn)


async def update_bill(
    bill_id: int, profile_id: int, data: dict, conn: asyncpg.Connection
) -> dict | None:
    existing = await get_bill(bill_id, profile_id, conn)
    if not existing:
        return None
    if data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(data)]
        await conn.execute(
            f"UPDATE bills SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            bill_id,
            profile_id,
            *data.values(),
        )
    return await get_bill(bill_id, profile_id, conn)


async def delete_bill(bill_id: int, profile_id: int, conn: asyncpg.Connection) -> bool:
    result = await conn.execute(
        "DELETE FROM bills WHERE id = $1 AND profile_id = $2", bill_id, profile_id
    )
    return result != "DELETE 0"


async def get_bill_history(bill_id: int, profile_id: int, conn: asyncpg.Connection) -> dict:
    txs = await conn.fetch(
        """SELECT t.id, t.amount, t.description, t.date, c.name AS category_name
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.bill_id = $1 AND t.profile_id = $2
           ORDER BY t.date DESC""",
        bill_id,
        profile_id,
    )

    # 'month' is a hardcoded literal, not user input — inlining it directly avoids
    # the classic SQLAlchemy pitfall (separate bind params per date_trunc() call
    # making Postgres see mismatched GROUP BY expressions). Not an issue with raw
    # SQL since the literal is identical text in SELECT/GROUP BY/ORDER BY.
    monthly = await conn.fetch(
        """SELECT date_trunc('month', date) AS month, SUM(amount) AS total
           FROM transactions
           WHERE bill_id = $1 AND profile_id = $2 AND transaction_type = 'expense'
           GROUP BY date_trunc('month', date)
           ORDER BY date_trunc('month', date)""",
        bill_id,
        profile_id,
    )

    return {
        "transactions": [
            {
                "id": t["id"],
                "amount": float(t["amount"]),
                "description": t["description"],
                "date": t["date"].isoformat(),
                "category_name": t["category_name"],
            }
            for t in txs
        ],
        "monthly_spending": [
            {"month": row["month"].strftime("%Y-%m"), "amount": float(row["total"])}
            for row in monthly
        ],
    }


async def suggest_bill_match(
    profile_id: int,
    description: str,
    amount: float,
    tx_date: datetime,
    merchant_id: int | None,
    conn: asyncpg.Connection,
) -> dict | None:
    """Find a bill that likely matches this transaction."""
    amount_dec = Decimal(str(amount))
    bills = await get_bills(profile_id, conn)
    today = tx_date.date()

    for bill in bills:
        if bill["merchant_id"] and bill["merchant_id"] == merchant_id:
            next_due = _next_due_date(bill["due_day"], bill["frequency"])
            days_diff = abs((next_due - today).days)
            if days_diff <= 5:
                amount_diff = abs(Decimal(str(bill["amount"])) - amount_dec)
                if amount_diff <= Decimal(str(bill["amount"])) * Decimal("0.2"):
                    return bill

    for bill in bills:
        desc_lower = description.lower()
        bill_lower = bill["name"].lower()
        if bill_lower in desc_lower or desc_lower in bill_lower:
            next_due = _next_due_date(bill["due_day"], bill["frequency"])
            days_diff = abs((next_due - today).days)
            if days_diff <= 7:
                return bill

    return None


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


async def compute_upcoming_async(
    bills: list[dict], days: int, conn: asyncpg.Connection
) -> list[dict]:
    today = date.today()
    cutoff = today + timedelta(days=days)
    upcoming: list[dict] = []

    for bill in bills:
        next_due = _next_due_date(bill["due_day"], bill["frequency"])
        if today <= next_due <= cutoff:
            # "Already paid this period" is a transaction tied to this bill dated
            # within the ~30-day window leading up to (and including) this
            # occurrence's due date. Both bounds matter — without the upper bound,
            # a payment made for last period's occurrence would also satisfy this
            # period's (wider, overlapping) window and be double-counted as paid.
            period_start = datetime.combine(next_due - timedelta(days=30), datetime.min.time())
            period_end = datetime.combine(next_due + timedelta(days=1), datetime.min.time())
            has_paid_row = await conn.fetchrow(
                "SELECT 1 FROM transactions WHERE bill_id = $1 AND date >= $2 AND date < $3 LIMIT 1",
                bill["id"],
                period_start,
                period_end,
            )
            upcoming.append(
                {
                    "id": bill["id"],
                    "name": bill["name"],
                    "amount": float(bill["amount"]),
                    "amount_estimated": float(bill["amount_estimated"])
                    if bill["amount_estimated"]
                    else None,
                    "frequency": bill["frequency"],
                    "due_day": bill["due_day"],
                    "next_due": next_due.isoformat(),
                    "days_until": (next_due - today).days,
                    "category_name": bill["category_name"],
                    "account_name": bill["account_name"],
                    "merchant_name": bill["merchant_name"],
                    "is_variable": bill["is_variable"],
                    "has_paid": has_paid_row is not None,
                }
            )

    upcoming.sort(key=lambda b: b["days_until"])
    return upcoming
