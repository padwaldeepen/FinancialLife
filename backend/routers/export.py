import csv
import io
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Account, Category, Merchant, Transaction, User
from database.session import get_db
from routers.auth import get_current_user

router = APIRouter()


@router.get("/csv")
async def export_csv(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Transaction.user_id == current_user.id]

    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            conditions.append(Transaction.date >= dt_from)
        except ValueError:
            pass
    else:
        conditions.append(Transaction.date >= datetime.now() - timedelta(days=365))

    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            conditions.append(Transaction.date < dt_to)
        except ValueError:
            pass

    result = await db.execute(
        select(Transaction).where(*conditions).order_by(Transaction.date.desc())
    )
    transactions = result.scalars().all()

    cat_ids = {tx.category_id for tx in transactions if tx.category_id}
    merchant_ids = {tx.merchant_id for tx in transactions if tx.merchant_id}
    account_ids = {tx.account_id for tx in transactions if tx.account_id}

    cats = {}
    if cat_ids:
        cat_result = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
        cats = {c.id: c.name for c in cat_result.scalars()}

    merchants = {}
    if merchant_ids:
        m_result = await db.execute(select(Merchant).where(Merchant.id.in_(merchant_ids)))
        merchants = {m.id: m.name for m in m_result.scalars()}

    accounts = {}
    if account_ids:
        a_result = await db.execute(select(Account).where(Account.id.in_(account_ids)))
        accounts = {a.id: a.name for a in a_result.scalars()}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Date",
            "Description",
            "Amount",
            "Type",
            "Category",
            "Merchant",
            "Account",
            "Notes",
        ]
    )

    for tx in transactions:
        writer.writerow(
            [
                tx.date.strftime("%Y-%m-%d"),
                tx.description,
                f"{tx.amount:.2f}",
                tx.transaction_type,
                cats.get(tx.category_id, ""),
                merchants.get(tx.merchant_id, ""),
                accounts.get(tx.account_id, ""),
                tx.notes or "",
            ]
        )

    output.seek(0)
    today = date.today().strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=my-financial-life-{today}.csv"},
    )
