from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Account, Transaction, User


async def create_default_account(user: User, db: AsyncSession) -> Account:
    account = Account(
        user_id=user.id,
        name="Cash",
        type="checking",
        currency="USD",
        sort_order=0,
    )
    db.add(account)
    await db.flush()
    return account


async def get_accounts(user_id: int, db: AsyncSession) -> list[Account]:
    result = await db.execute(
        select(Account)
        .where(Account.user_id == user_id, Account.is_active)
        .order_by(Account.sort_order)
    )
    return result.scalars().all()


async def get_account(account_id: int, user_id: int, db: AsyncSession) -> Account | None:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def create_account(
    user_id: int, name: str, type: str, currency: str, db: AsyncSession
) -> Account:
    account = Account(
        user_id=user_id,
        name=name,
        type=type,
        currency=currency,
    )
    db.add(account)
    await db.flush()
    return account


async def update_account(
    account_id: int, user_id: int, data: dict, db: AsyncSession
) -> Account | None:
    account = await get_account(account_id, user_id, db)
    if not account:
        return None
    for field, value in data.items():
        setattr(account, field, value)
    await db.flush()
    return account


async def delete_account(account_id: int, user_id: int, db: AsyncSession) -> bool:
    account = await get_account(account_id, user_id, db)
    if not account:
        return False
    await db.delete(account)
    await db.flush()
    return True


async def get_account_balances(user_id: int, db: AsyncSession) -> dict[int, float]:
    result = await db.execute(
        select(
            Transaction.account_id,
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.transaction_type == "income"), 0
            ),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.transaction_type == "expense"), 0
            ),
        )
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.account_id)
    )
    balances: dict[int, float] = {}
    for account_id, income, expense in result.all():
        balances[account_id] = float(income) - float(expense)
    return balances


async def get_account_balance(account_id: int, db: AsyncSession) -> float:
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.transaction_type == "income"), 0
            ),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.transaction_type == "expense"), 0
            ),
        ).where(Transaction.account_id == account_id)
    )
    row = result.one()
    return float(row[0]) - float(row[1])
