from datetime import datetime
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.money import Money
from database.models import MAX_MONEY_AMOUNT, Profile
from database.session import get_db
from routers.auth import get_current_profile
from services.account_service import get_valid_account_ids
from services.ai.ai_service import AIService
from services.ai.consent import cloud_enabled
from services.bill_service import suggest_bill_match
from services.category_service import get_valid_category_ids
from services.category_spend import CATEGORY_SPEND_SOURCE
from services.ingest.dedup import DedupCandidate, compute_import_hash, find_duplicates
from services.merchant_service import (
    extract_merchant_from_description,
    find_matching_merchant,
    find_or_create_merchant,
    get_valid_merchant_ids,
    normalize_name,
)
from services.transaction_service import (
    check_category_owned,
    check_related_ids_owned,
    parse_transaction,
)

router = APIRouter()

ai_service = AIService()

MAX_IMPORT_ROWS = 10000

_TX_JOIN = """
    SELECT t.*, a.name AS account_name, c.name AS category_name, c.color AS category_color,
           m.name AS merchant_name, ta.name AS to_account_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN merchants m ON m.id = t.merchant_id
    LEFT JOIN accounts ta ON ta.id = t.to_account_id
"""


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT, description="Amount must be positive")
    description: str
    transaction_type: Literal["income", "expense", "transfer"]
    account_id: int
    # E1: destination for a transfer. Required when transaction_type == 'transfer'
    # (enforced in the endpoint, where the ownership check already runs), ignored
    # otherwise.
    to_account_id: int | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool = False
    is_recurring: bool = False
    date: datetime
    notes: str | None = None


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    description: str | None = None
    transaction_type: Literal["income", "expense", "transfer"] | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool | None = None
    is_recurring: bool | None = None
    date: datetime | None = None
    notes: str | None = None


class TransactionResponse(BaseModel):
    id: int
    amount: Money
    description: str
    transaction_type: str
    account_id: int
    account_name: str | None = None
    to_account_id: int | None = None
    to_account_name: str | None = None
    category_id: int | None
    category_name: str | None
    category_color: str | None
    merchant_id: int | None = None
    merchant_name: str | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool = False
    is_recurring: bool = False
    date: datetime
    notes: str | None
    ai_categorized: bool
    source: str = "manual"
    document_id: int | None = None
    # E2: which purchase this row reverses, when it is a refund. Drives the "Refund"
    # badge — a refund is a negative expense, so without a label the row reads as an
    # ordinary purchase that happens to be green.
    refund_of_transaction_id: int | None = None
    is_split: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(row: dict) -> TransactionResponse:
    return TransactionResponse(
        id=row["id"],
        # R6: no float() — the column is NUMERIC and the field is Decimal;
        # core/money.py converts once, at JSON serialisation.
        amount=row["amount"],
        description=row["description"],
        transaction_type=row["transaction_type"],
        account_id=row["account_id"],
        account_name=row.get("account_name"),
        to_account_id=row.get("to_account_id"),
        to_account_name=row.get("to_account_name"),
        category_id=row["category_id"],
        category_name=row.get("category_name"),
        category_color=row.get("category_color"),
        merchant_id=row["merchant_id"],
        merchant_name=row.get("merchant_name"),
        bill_id=row["bill_id"],
        goal_id=row["goal_id"],
        is_pending=row["is_pending"],
        is_recurring=row["is_recurring"],
        date=row["date"],
        notes=row["notes"],
        ai_categorized=row["ai_categorized"],
        source=row.get("source", "manual"),
        document_id=row.get("document_id"),
        refund_of_transaction_id=row.get("refund_of_transaction_id"),
        is_split=row.get("is_split", False),
        created_at=row["created_at"],
    )


class CategorySummary(BaseModel):
    category_id: int | None
    category_name: str
    category_color: str
    total_amount: float
    transaction_count: int


class DashboardSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_amount: float
    category_summaries: list[CategorySummary]
    recent_transactions: list[TransactionResponse]


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    await check_category_owned(transaction_data.category_id, profile, conn)
    await check_related_ids_owned(
        account_id=transaction_data.account_id,
        bill_id=transaction_data.bill_id,
        goal_id=transaction_data.goal_id,
        merchant_id=transaction_data.merchant_id,
        profile=profile,
        conn=conn,
    )
    _validate_transfer(
        transaction_data.transaction_type,
        transaction_data.account_id,
        transaction_data.to_account_id,
    )
    # The destination is an account like any other, so it gets the same ownership check
    # — otherwise a transfer could push money into another profile's account.
    if transaction_data.to_account_id is not None:
        await check_related_ids_owned(
            account_id=transaction_data.to_account_id, profile=profile, conn=conn
        )

    merchant_id = transaction_data.merchant_id
    if merchant_id is None:
        merchant_name = extract_merchant_from_description(transaction_data.description)
        if merchant_name:
            merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
            merchant_id = merchant.id if merchant else None

    tx_id = await conn.fetchval(
        """INSERT INTO transactions
             (amount, description, transaction_type, account_id, category_id, merchant_id,
              bill_id, goal_id, is_pending, is_recurring, profile_id, date, notes, source,
              to_account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual', $14)
           RETURNING id""",
        transaction_data.amount,
        transaction_data.description,
        transaction_data.transaction_type,
        transaction_data.account_id,
        transaction_data.category_id,
        merchant_id,
        transaction_data.bill_id,
        transaction_data.goal_id,
        transaction_data.is_pending,
        transaction_data.is_recurring,
        profile.id,
        transaction_data.date,
        transaction_data.notes,
        transaction_data.to_account_id if transaction_data.transaction_type == "transfer" else None,
    )

    if transaction_data.bill_id is None:
        matched_bill = await suggest_bill_match(
            profile.id,
            transaction_data.description,
            transaction_data.amount,
            transaction_data.date,
            merchant_id,
            conn,
        )
        if matched_bill:
            await conn.execute(
                "UPDATE transactions SET bill_id = $1 WHERE id = $2", matched_bill["id"], tx_id
            )

    row = await conn.fetchrow(_TX_JOIN + " WHERE t.id = $1", tx_id)
    return _to_response(dict(row))


@router.get("/", response_model=list[TransactionResponse])
async def get_transactions(
    skip: int = 0,
    limit: int = 100,
    transaction_type: str | None = None,
    category_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    conditions = ["t.profile_id = $1"]
    params: list = [profile.id]

    if transaction_type:
        params.append(transaction_type)
        conditions.append(f"t.transaction_type = ${len(params)}")
    if category_id:
        params.append(category_id)
        conditions.append(f"t.category_id = ${len(params)}")
    if start_date:
        params.append(start_date)
        conditions.append(f"t.date >= ${len(params)}")
    if end_date:
        params.append(end_date)
        conditions.append(f"t.date <= ${len(params)}")
    if search:
        params.append(f"%{search}%")
        conditions.append(f"t.description ILIKE ${len(params)}")

    allowed_sort_columns = {"date", "amount", "description", "created_at", "transaction_type"}
    if sort_by not in allowed_sort_columns:
        sort_by = "date"
    direction = "ASC" if sort_order == "asc" else "DESC"

    params.extend([limit, skip])
    query = (
        _TX_JOIN
        + f" WHERE {' AND '.join(conditions)}"
        + f" ORDER BY t.{sort_by} {direction}"
        + f" LIMIT ${len(params) - 1} OFFSET ${len(params)}"
    )
    rows = await conn.fetch(query, *params)
    return [_to_response(dict(r)) for r in rows]


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        _TX_JOIN + " WHERE t.id = $1 AND t.profile_id = $2", transaction_id, profile.id
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return _to_response(dict(row))


async def _resolve_account_by_name(
    profile_id: int, name: str, conn: asyncpg.Connection
) -> asyncpg.Record | None:
    """E1: turn "savings" from quick-add text into a real account in this profile.

    Exact (case-insensitive) first, then a unique prefix match so "savings" finds
    "Savings Account". **A prefix that matches more than one account resolves to
    nothing** rather than guessing — silently moving money into the wrong account is far
    worse than asking the user to be specific.
    """
    exact = await conn.fetchrow(
        "SELECT id, name FROM accounts WHERE profile_id = $1 AND LOWER(name) = LOWER($2)",
        profile_id,
        name,
    )
    if exact:
        return exact
    matches = await conn.fetch(
        """SELECT id, name FROM accounts
           WHERE profile_id = $1 AND LOWER(name) LIKE LOWER($2) || '%'""",
        profile_id,
        name,
    )
    return matches[0] if len(matches) == 1 else None


def _validate_transfer(
    transaction_type: str | None, account_id: int | None, to_account_id: int | None
) -> None:
    """E1: a transfer without a destination isn't a transfer, and one that points at its
    own source silently does nothing while looking like it worked. Both are rejected
    here rather than stored as a row that quietly fails to move any money."""
    if transaction_type != "transfer":
        return
    if to_account_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A transfer needs a destination account.",
        )
    if account_id is not None and to_account_id == account_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A transfer's source and destination must be different accounts.",
        )


async def _remember_merchant_category(
    transaction_id: int,
    merchant_id_in_update: int | None,
    category_id: int,
    profile: Profile,
    conn: asyncpg.Connection,
) -> None:
    """Y7: record "this merchant belongs in this category" after a manual correction.

    The merchant may or may not be part of the same edit, so fall back to whatever the
    transaction already points at. If there's no merchant, there's nothing to key the
    rule on and we simply don't learn — a one-off description like "misc cash" shouldn't
    invent a rule.

    Scoped by `profile_id` in the UPDATE itself rather than trusting the id: merchants
    are per-profile and a correction in one country profile must never move a
    same-named merchant in another.
    """
    merchant_id = merchant_id_in_update
    if merchant_id is None:
        merchant_id = await conn.fetchval(
            "SELECT merchant_id FROM transactions WHERE id = $1", transaction_id
        )
    if merchant_id is None:
        return

    await conn.execute(
        """UPDATE merchants SET default_category_id = $1
           WHERE id = $2 AND profile_id = $3""",
        category_id,
        merchant_id,
        profile.id,
    )


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    existing = await conn.fetchrow(
        "SELECT id FROM transactions WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await check_category_owned(transaction_data.category_id, profile, conn)
    await check_related_ids_owned(
        account_id=transaction_data.account_id,
        bill_id=transaction_data.bill_id,
        goal_id=transaction_data.goal_id,
        merchant_id=transaction_data.merchant_id,
        profile=profile,
        conn=conn,
    )

    update_data_preview = transaction_data.model_dump(exclude_unset=True)

    # On update the type and accounts may each be absent, so fall back to what the row
    # already has before judging whether the *result* is a valid transfer.
    if "transaction_type" in update_data_preview or "to_account_id" in update_data_preview:
        current = await conn.fetchrow(
            "SELECT transaction_type, account_id, to_account_id FROM transactions WHERE id = $1",
            transaction_id,
        )
        resulting_type = update_data_preview.get("transaction_type", current["transaction_type"])
        _validate_transfer(
            resulting_type,
            update_data_preview.get("account_id", current["account_id"]),
            update_data_preview.get("to_account_id", current["to_account_id"]),
        )
        # Editing a transfer into an expense must drop the destination, exactly as the
        # create path does. Without this the row keeps a `to_account_id` it no longer
        # means: balances stay right (BALANCE_DELTAS gates the incoming leg on the type)
        # but the UI shows a destination account on a plain expense, and any future query
        # that forgets that type guard would double-count it.
        if resulting_type != "transfer" and current["to_account_id"] is not None:
            update_data_preview["to_account_id"] = None
    if transaction_data.to_account_id is not None:
        await check_related_ids_owned(
            account_id=transaction_data.to_account_id, profile=profile, conn=conn
        )

    update_data = update_data_preview
    if update_data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(update_data)]
        await conn.execute(
            f"UPDATE transactions SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            transaction_id,
            profile.id,
            *update_data.values(),
        )

    # Y7: a category the user chose by hand is the strongest signal there is about where
    # this merchant belongs — remember it so the same correction isn't needed twice.
    # Only on an explicit category change (`exclude_unset` above means an untouched
    # field never reaches here), and only when we can attribute it to a merchant.
    if "category_id" in update_data and update_data["category_id"] is not None:
        await _remember_merchant_category(
            transaction_id,
            update_data.get("merchant_id"),
            update_data["category_id"],
            profile,
            conn,
        )

    row = await conn.fetchrow(_TX_JOIN + " WHERE t.id = $1", transaction_id)
    return _to_response(dict(row))


class SplitPart(BaseModel):
    category_id: int | None = None
    amount: Money = Field(gt=0, le=MAX_MONEY_AMOUNT)
    note: str | None = None


class SplitRequest(BaseModel):
    parts: list[SplitPart] = Field(min_length=2, max_length=50)


class SplitPartResponse(BaseModel):
    id: int
    category_id: int | None
    category_name: str | None
    amount: Money
    note: str | None


@router.get("/{transaction_id}/splits", response_model=list[SplitPartResponse])
async def get_splits(
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    owned = await conn.fetchrow(
        "SELECT id FROM transactions WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    rows = await conn.fetch(
        """SELECT s.id, s.category_id, s.amount, s.note, c.name AS category_name
             FROM transaction_splits s
             LEFT JOIN categories c ON c.id = s.category_id
            WHERE s.transaction_id = $1
         ORDER BY s.id""",
        transaction_id,
    )
    return [SplitPartResponse(**dict(r)) for r in rows]


@router.put("/{transaction_id}/splits", response_model=list[SplitPartResponse])
async def set_splits(
    transaction_id: int,
    payload: SplitRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """E3: replace this transaction's split parts.

    The parts must sum to the transaction's amount **exactly**. That check is done in
    `Decimal`, never float — `0.1 + 0.2 != 0.3` in binary floating point, so a float
    comparison would reject perfectly valid three-way splits of everyday amounts and
    accept ones that are a cent off. Exactness is the whole point: an inexact split
    silently moves money between categories.
    """
    tx = await conn.fetchrow(
        "SELECT id, amount, transaction_type FROM transactions WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if tx["transaction_type"] == "transfer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A transfer moves money between your own accounts, so it has no categories to split",
        )

    for part in payload.parts:
        await check_category_owned(part.category_id, profile, conn)

    total = sum((p.amount for p in payload.parts), Decimal(0))
    if total != tx["amount"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Split parts total {total}, but the transaction is {tx['amount']}. "
                "They must match exactly."
            ),
        )

    async with conn.transaction():
        await conn.execute(
            "DELETE FROM transaction_splits WHERE transaction_id = $1", transaction_id
        )
        for part in payload.parts:
            await conn.execute(
                """INSERT INTO transaction_splits (transaction_id, category_id, amount, note)
                   VALUES ($1, $2, $3, $4)""",
                transaction_id,
                part.category_id,
                part.amount,
                part.note,
            )
        await conn.execute("UPDATE transactions SET is_split = TRUE WHERE id = $1", transaction_id)

    return await get_splits(transaction_id, profile, conn)


@router.delete("/{transaction_id}/splits", status_code=status.HTTP_204_NO_CONTENT)
async def clear_splits(
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Un-split: the transaction goes back to counting under its own category."""
    owned = await conn.fetchrow(
        "SELECT id FROM transactions WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    async with conn.transaction():
        await conn.execute(
            "DELETE FROM transaction_splits WHERE transaction_id = $1", transaction_id
        )
        await conn.execute("UPDATE transactions SET is_split = FALSE WHERE id = $1", transaction_id)


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    result = await conn.execute(
        "DELETE FROM transactions WHERE id = $1 AND profile_id = $2", transaction_id, profile.id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return {"message": "Transaction deleted successfully"}


@router.get(
    "/summary/dashboard",
    response_model=DashboardSummary,
    deprecated=True,
    description="DEPRECATED — will be replaced by account-based endpoints in Phase 6 (Home screen).",
)
async def get_dashboard_summary(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    now = datetime.now()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    income_result = await conn.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM transactions
           WHERE profile_id = $1 AND transaction_type = 'income' AND date >= $2""",
        profile.id,
        start_of_month,
    )
    expense_result = await conn.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM transactions
           WHERE profile_id = $1 AND transaction_type = 'expense' AND date >= $2""",
        profile.id,
        start_of_month,
    )

    category_rows = await conn.fetch(
        f"""SELECT t.category_id, c.name AS category_name, c.color AS category_color,
                  SUM(t.amount) AS total_amount, COUNT(t.id) AS transaction_count
           FROM ({CATEGORY_SPEND_SOURCE}) t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense' AND t.date >= $2
           GROUP BY t.category_id, c.name, c.color""",
        profile.id,
        start_of_month,
    )
    formatted_summaries = [
        CategorySummary(
            category_id=r["category_id"],
            category_name=r["category_name"] or "Uncategorized",
            category_color=r["category_color"] or "#6B7280",
            total_amount=float(r["total_amount"]),
            transaction_count=r["transaction_count"],
        )
        for r in category_rows
    ]

    recent_rows = await conn.fetch(
        _TX_JOIN + " WHERE t.profile_id = $1 ORDER BY t.date DESC LIMIT 10", profile.id
    )
    formatted_transactions = [_to_response(dict(r)) for r in recent_rows]

    return DashboardSummary(
        total_income=float(income_result),
        total_expenses=float(expense_result),
        net_amount=float(income_result) - float(expense_result),
        category_summaries=formatted_summaries,
        recent_transactions=formatted_transactions,
    )


class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    amount: Money | None
    description: str
    type: str
    category: str | None
    merchant: str | None = None
    ai_provider: str | None = None
    date: datetime | None = None
    missing: list[str] = []
    raw_text: str


class QuickAddRequest(BaseModel):
    text: str
    category_id: int | None = None
    # One-question rule (design-system.md §4): when /parse comes back with
    # missing=["amount"], the client asks a single inline "How much?" follow-up and
    # resends here with the corrected amount rather than re-parsing it from text.
    amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)


async def _preview_merchant_name(
    profile_id: int, raw_name: str | None, conn: asyncpg.Connection
) -> str | None:
    """D5: the parse preview shows the corrected merchant name ("Walmart") before
    anything saves, not the raw typo'd text ("wallmart") — read-only, creates nothing."""
    if not raw_name:
        return None
    match = await find_matching_merchant(profile_id, raw_name, conn)
    return match.name if match else raw_name


async def _learned_category_for_merchant(
    profile_id: int, raw_name: str | None, conn: asyncpg.Connection
) -> tuple[int | None, str | None]:
    """Y7: the category the user previously chose for this merchant, if any.

    Goes through the same D5 fuzzy matcher the rest of the merchant path uses, so a
    near-miss spelling resolves to the merchant the rule was learned against rather than
    silently missing.

    **Known limit (measured, not assumed):** this only helps once *something* has been
    extracted as a merchant name. "chipotle 22" yields merchant "Chipotle" and picks up
    the rule; "chipotel 14" currently yields **no merchant at all** from
    `extract_merchant_from_description`, so it never reaches this function. That's a
    pre-existing extraction limitation, not a matching one — out of Y7's scope, noted in
    backlog.md's Discovered list.

    Returns (id, name) so callers can both set the category and show its name in a
    preview. (None, None) means nothing learned — fall back to keyword matching.
    """
    if not raw_name:
        return None, None
    match = await find_matching_merchant(profile_id, raw_name, conn)
    if match is None or match.default_category_id is None:
        return None, None
    row = await conn.fetchrow(
        "SELECT id, name FROM categories WHERE id = $1", match.default_category_id
    )
    return (row["id"], row["name"]) if row else (None, None)


async def _rules_first_parse(text: str, cloud_enabled: bool) -> dict:
    """S7: rules first (T1 contract), Gemini fallback **only when rules can't find the
    amount** and the user opted into cloud AI. The amount is the one field the
    preview/one-question flow can't infer for the user, so it's the honest "rules
    genuinely couldn't" trigger — everything else (description, category, merchant, date)
    rules + D5 fuzzy matching resolve locally, with the preview for correction. Net effect:
    common inputs ("coffee 4.50") **never leave the machine**, even with the toggle on;
    the cloud is touched only for input rules truly can't handle, and never when the
    toggle is off. Returns a normalized candidate dict with `provider` = "rules" | "gemini"."""
    rules = parse_transaction(text)

    if rules["amount"] is None and cloud_enabled:
        ai = await ai_service.parse(text, cloud_enabled=True)
        if ai is not None and ai.amount is not None:
            return {
                "amount": ai.amount,
                "description": ai.description,
                "type": ai.transaction_type,
                "category": ai.category,
                "merchant": ai.merchant,
                "date": None,
                "date_explicit": False,
                "missing": [],
                "provider": "gemini",
                # Gemini has no transfer concept in its contract; only the rules parser
                # recognises them (E1), so a cloud fallback is never a transfer.
                "transfer_to": None,
            }

    return {
        "amount": rules["amount"],
        "description": rules["description"],
        "type": rules["type"],
        "category": rules["category"],
        "merchant": extract_merchant_from_description(rules["description"]),
        "date": rules["date"],
        "date_explicit": rules["date_explicit"],
        "missing": rules["missing"],
        "provider": "rules",
        "transfer_to": rules.get("transfer_to"),
    }


@router.post("/parse", response_model=ParseResponse)
async def parse_transaction_text(
    request: ParseRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    ai_enabled = await cloud_enabled(profile, conn)
    parsed = await _rules_first_parse(request.text, ai_enabled)
    merchant_display = await _preview_merchant_name(profile.id, parsed["merchant"], conn)
    # Y7: a category the user taught us for this merchant beats the keyword guess, and
    # the preview must show the category that will actually be saved — otherwise the
    # confirmation card would promise one thing and quick-add would do another.
    _, learned_category_name = await _learned_category_for_merchant(
        profile.id, parsed["merchant"], conn
    )
    return ParseResponse(
        amount=parsed["amount"],
        description=parsed["description"],
        type=parsed["type"],
        category=learned_category_name or parsed["category"],
        merchant=merchant_display,
        ai_provider="gemini" if parsed["provider"] == "gemini" else None,
        date=datetime.combine(parsed["date"], datetime.min.time())
        if parsed["date_explicit"]
        else None,
        missing=parsed["missing"],
        raw_text=request.text,
    )


@router.post("/quick-add", response_model=TransactionResponse)
async def quick_add_transaction(
    request: QuickAddRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    ai_enabled = await cloud_enabled(profile, conn)
    parsed = await _rules_first_parse(request.text, ai_enabled)

    parsed_amount = parsed["amount"]
    # Only fills in the amount when parsing genuinely couldn't find one (the
    # one-question-rule follow-up) — never overrides an amount the parser already
    # extracted correctly, even if a caller sends a stale `amount` alongside it.
    if parsed_amount is None and request.amount is not None:
        parsed_amount = request.amount
    if parsed_amount is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse an amount from the text. Try something like 'spent 15 on groceries'.",
        )
    # Parser-extracted amounts skip QuickAddRequest's own Field validation entirely
    # (they come from `parsed`, not `request.amount`) — without this check, a huge
    # number in the free text reached the NUMERIC(12,2) column uncaught and raised a
    # raw 500 instead of a clean 422.
    if parsed_amount <= 0 or parsed_amount > MAX_MONEY_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Amount must be between 0 and {MAX_MONEY_AMOUNT:,.2f}.",
        )

    parsed_description = parsed["description"]
    parsed_type = parsed["type"]
    parsed_category = parsed["category"]
    merchant_name = parsed["merchant"]
    parsed_date = (
        datetime.combine(parsed["date"], datetime.min.time())
        if parsed["date_explicit"]
        else datetime.now()
    )

    # Y7 precedence, most-specific first: a category the user picked *for this
    # transaction* > one they taught us for this merchant > the keyword guess. The
    # learned rule sits in the middle deliberately — it must not override an explicit
    # choice being made right now, but it must beat a generic keyword match.
    category_id = None
    if request.category_id is not None:
        cat = await conn.fetchrow(
            "SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)",
            request.category_id,
            profile.user_id,
        )
        if cat:
            category_id = cat["id"]
    if category_id is None:
        learned_id, _ = await _learned_category_for_merchant(profile.id, merchant_name, conn)
        category_id = learned_id
    if category_id is None and parsed_category:
        cat = await conn.fetchrow(
            "SELECT id FROM categories WHERE name = $1 AND (user_id = $2 OR is_system = TRUE)",
            parsed_category,
            profile.user_id,
        )
        if cat:
            category_id = cat["id"]
        else:
            category_id = await conn.fetchval(
                "INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING id",
                parsed_category,
                profile.user_id,
            )

    default_account = await conn.fetchrow(
        """SELECT * FROM accounts WHERE profile_id = $1 AND is_active
           ORDER BY sort_order LIMIT 1""",
        profile.id,
    )
    if not default_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active account found. Create an account first.",
        )

    # E1: "transfer 500 to savings". The destination must resolve to a real account in
    # this profile — if it doesn't, refuse rather than silently booking an expense, which
    # is precisely the double-counting this ticket exists to stop.
    to_account_id = None
    if parsed_type == "transfer":
        dest = await _resolve_account_by_name(profile.id, parsed["transfer_to"] or "", conn)
        if dest is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f'No account matches "{parsed["transfer_to"]}". '
                    'Use the account\'s name, e.g. "transfer 500 to Savings".'
                ),
            )
        if dest["id"] == default_account["id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A transfer's source and destination must be different accounts.",
            )
        to_account_id = dest["id"]
        parsed_description = f"Transfer to {dest['name']}"

    merchant_id = None
    # A transfer has no merchant — inventing one ("Savings") would pollute the merchant
    # list and the Y7 learned-category rules with something that isn't a payee.
    if merchant_name and parsed_type != "transfer":
        merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
        merchant_id = merchant.id if merchant else None

    tx_id = await conn.fetchval(
        """INSERT INTO transactions
             (amount, description, transaction_type, account_id, category_id, merchant_id,
              profile_id, date, ai_categorized, source, to_account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'quick_add', $9)
           RETURNING id""",
        parsed_amount,
        parsed_description,
        parsed_type,
        default_account["id"],
        category_id,
        merchant_id,
        profile.id,
        parsed_date,
        to_account_id,
    )

    # Bill matching is about payees; a self-transfer can never be a bill payment.
    matched_bill = (
        None
        if parsed_type == "transfer"
        else await suggest_bill_match(
            profile.id, parsed_description, parsed_amount, parsed_date, merchant_id, conn
        )
    )
    if matched_bill:
        await conn.execute(
            "UPDATE transactions SET bill_id = $1 WHERE id = $2", matched_bill["id"], tx_id
        )

    row = await conn.fetchrow(_TX_JOIN + " WHERE t.id = $1", tx_id)
    return _to_response(dict(row))


class TransactionImport(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    description: str
    transaction_type: Literal["income", "expense", "transfer"] = "expense"
    account_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    date: datetime
    notes: str | None = None
    # Set on the resubmitted row when the user picked "keep both" for a fuzzy match
    # in the review queue (U4) — bypasses the dedup gate, still records import_hash.
    skip_dedup: bool = False


class ImportRequest(BaseModel):
    transactions: list[TransactionImport] = Field(max_length=MAX_IMPORT_ROWS)


class FuzzyMatchInfo(BaseModel):
    transaction_id: int
    date: datetime
    amount: Money
    description: str
    merchant_name: str | None
    similarity: float


class PendingReviewRow(BaseModel):
    row_index: int
    transaction: TransactionImport
    matches: list[FuzzyMatchInfo]


class ImportResponse(BaseModel):
    imported: int
    exact_skipped: int
    pending_review: list[PendingReviewRow]
    errors: list[str]


@router.post("/import", response_model=ImportResponse, status_code=status.HTTP_201_CREATED)
async def import_transactions(
    request: ImportRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    imported = 0
    exact_skipped = 0
    pending_review: list[PendingReviewRow] = []
    errors: list[str] = []

    # Batch-fetched once (not per-row) so a caller can't post a foreign profile's
    # account/category id into this profile's transactions — matches the ownership
    # guard on the single-transaction create/update endpoints.
    valid_account_ids = await get_valid_account_ids(profile.id, conn)
    valid_category_ids = await get_valid_category_ids(profile.user_id, conn)
    valid_merchant_ids = await get_valid_merchant_ids(profile.id, conn)

    async with conn.transaction():
        for i, tx in enumerate(request.transactions):
            try:
                if tx.account_id not in valid_account_ids:
                    raise ValueError(f"account {tx.account_id} not found")
                if tx.category_id is not None and tx.category_id not in valid_category_ids:
                    raise ValueError(f"category {tx.category_id} not found")

                # The frontend sends `date.toISOString()` (tz-aware, UTC) but the
                # `transactions.date` column is `timestamp without time zone` — asyncpg
                # can't insert a tz-aware value into a naive column ("can't subtract
                # offset-naive and offset-aware datetimes"). Normalize once, up front.
                tx_date = tx.date.replace(tzinfo=None) if tx.date.tzinfo else tx.date
                merchant_id = tx.merchant_id
                if merchant_id is not None and merchant_id not in valid_merchant_ids:
                    raise ValueError(f"merchant {merchant_id} not found")
                merchant_name = None
                if merchant_id is None:
                    merchant_name = extract_merchant_from_description(tx.description)
                    if merchant_name:
                        merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
                        merchant_id = merchant.id if merchant else None

                if tx.skip_dedup:
                    # User already reviewed this row's fuzzy matches and chose "keep
                    # both" — still fingerprint it so a FUTURE import can catch an
                    # exact repeat of *this* row.
                    normalized_desc = normalize_name(merchant_name or tx.description)
                    import_hash = compute_import_hash(
                        profile.id,
                        tx.account_id,
                        tx_date.date(),
                        Decimal(str(tx.amount)),
                        normalized_desc,
                    )
                else:
                    result = await find_duplicates(
                        DedupCandidate(
                            profile_id=profile.id,
                            account_id=tx.account_id,
                            date=tx_date.date(),
                            amount=Decimal(str(tx.amount)),
                            description=tx.description,
                            merchant_name=merchant_name,
                        ),
                        conn,
                    )
                    if result.status == "exact":
                        exact_skipped += 1
                        continue
                    if result.status == "fuzzy":
                        pending_review.append(
                            PendingReviewRow(
                                row_index=i + 1,
                                transaction=tx,
                                matches=[
                                    FuzzyMatchInfo(
                                        transaction_id=m.transaction_id,
                                        date=m.date,
                                        amount=float(m.amount),
                                        description=m.description,
                                        merchant_name=m.merchant_name,
                                        similarity=m.similarity,
                                    )
                                    for m in result.fuzzy_matches
                                ],
                            )
                        )
                        continue
                    import_hash = result.import_hash

                await conn.execute(
                    """INSERT INTO transactions
                         (amount, description, transaction_type, account_id, category_id,
                          merchant_id, profile_id, date, notes, source, import_hash)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'csv_import', $10)""",
                    tx.amount,
                    tx.description,
                    tx.transaction_type,
                    tx.account_id,
                    tx.category_id,
                    merchant_id,
                    profile.id,
                    tx_date,
                    tx.notes,
                    import_hash,
                )
                imported += 1
            except Exception as e:
                errors.append(f"Row {i + 1}: {e}")

    return ImportResponse(
        imported=imported,
        exact_skipped=exact_skipped,
        pending_review=pending_review,
        errors=errors,
    )
