import asyncpg

from database.models import Account, Profile


def _row_to_account(row: asyncpg.Record) -> Account:
    return Account(**dict(row))


# A new profile starts with a small base set of accounts (not just Checking) so the
# account picker on receipt/bill review and quick-add is useful out of the box rather
# than a single option. Balances start at 0 and the user renames/deletes/adds as needed.
# ("Debit" isn't a distinct type — a debit card draws from Checking, so Checking covers
# it.) Kept intentionally minimal: the three most common personal accounts, no phantom
# investment/cash accounts most people won't use.
_DEFAULT_ACCOUNTS: list[tuple[str, str]] = [
    ("Checking", "checking"),
    ("Savings", "savings"),
    ("Credit Card", "credit"),
]


async def create_default_account(profile: Profile, conn: asyncpg.Connection) -> Account:
    """Seeds the base accounts for a new profile; returns the first (Checking) so
    existing callers that expect a single Account back keep working."""
    created: list[Account] = []
    for sort_order, (name, acc_type) in enumerate(_DEFAULT_ACCOUNTS):
        row = await conn.fetchrow(
            """INSERT INTO accounts (profile_id, name, type, sort_order)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            profile.id,
            name,
            acc_type,
            sort_order,
        )
        created.append(_row_to_account(row))
    return created[0]


async def get_accounts(profile_id: int, conn: asyncpg.Connection) -> list[Account]:
    rows = await conn.fetch(
        """SELECT * FROM accounts WHERE profile_id = $1 AND is_active
           ORDER BY sort_order""",
        profile_id,
    )
    return [_row_to_account(row) for row in rows]


async def get_account(account_id: int, profile_id: int, conn: asyncpg.Connection) -> Account | None:
    row = await conn.fetchrow(
        "SELECT * FROM accounts WHERE id = $1 AND profile_id = $2",
        account_id,
        profile_id,
    )
    return _row_to_account(row) if row else None


async def create_account(
    profile_id: int, name: str, type: str, conn: asyncpg.Connection
) -> Account:
    row = await conn.fetchrow(
        """INSERT INTO accounts (profile_id, name, type) VALUES ($1, $2, $3) RETURNING *""",
        profile_id,
        name,
        type,
    )
    return _row_to_account(row)


async def update_account(
    account_id: int, profile_id: int, data: dict, conn: asyncpg.Connection
) -> Account | None:
    existing = await get_account(account_id, profile_id, conn)
    if not existing:
        return None
    if not data:
        return existing

    set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(data)]
    values = list(data.values())
    row = await conn.fetchrow(
        f"""UPDATE accounts SET {", ".join(set_clauses)}
            WHERE id = $1 AND profile_id = $2 RETURNING *""",
        account_id,
        profile_id,
        *values,
    )
    return _row_to_account(row)


async def delete_account(account_id: int, profile_id: int, conn: asyncpg.Connection) -> bool:
    result = await conn.execute(
        "DELETE FROM accounts WHERE id = $1 AND profile_id = $2",
        account_id,
        profile_id,
    )
    return result != "DELETE 0"


async def get_account_balances(profile_id: int, conn: asyncpg.Connection) -> dict[int, float]:
    rows = await conn.fetch(
        """SELECT account_id,
                  COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) AS income,
                  COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0) AS expense
           FROM transactions
           WHERE profile_id = $1
           GROUP BY account_id""",
        profile_id,
    )
    return {row["account_id"]: float(row["income"]) - float(row["expense"]) for row in rows}


async def get_account_balance(account_id: int, conn: asyncpg.Connection) -> float:
    row = await conn.fetchrow(
        """SELECT
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) AS income,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0) AS expense
           FROM transactions WHERE account_id = $1""",
        account_id,
    )
    return float(row["income"]) - float(row["expense"])
