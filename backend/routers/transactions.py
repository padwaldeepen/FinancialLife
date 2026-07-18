from datetime import datetime
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from services.ai.ai_service import AIService
from services.bill_service import auto_link_transaction, suggest_bill_match
from services.ingest.dedup import DedupCandidate, compute_import_hash, find_duplicates
from services.merchant_service import (
    extract_merchant_from_description,
    find_matching_merchant,
    find_or_create_merchant,
    normalize_name,
)
from services.transaction_service import parse_transaction

router = APIRouter()

ai_service = AIService()

MAX_IMPORT_ROWS = 10000

_TX_JOIN = """
    SELECT t.*, a.name AS account_name, c.name AS category_name, c.color AS category_color,
           m.name AS merchant_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN merchants m ON m.id = t.merchant_id
"""


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0, description="Amount must be positive")
    description: str
    transaction_type: Literal["income", "expense", "transfer"]
    account_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool = False
    is_recurring: bool = False
    date: datetime
    notes: str | None = None


class TransactionUpdate(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    description: str | None = None
    transaction_type: Literal["income", "expense", "transfer"] | None = None
    account_id: int | None = None
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
    amount: float
    description: str
    transaction_type: str
    account_id: int
    account_name: str | None = None
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
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(row: dict) -> TransactionResponse:
    return TransactionResponse(
        id=row["id"],
        amount=float(row["amount"]),
        description=row["description"],
        transaction_type=row["transaction_type"],
        account_id=row["account_id"],
        account_name=row.get("account_name"),
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
    if transaction_data.category_id is not None:
        cat = await conn.fetchrow(
            "SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)",
            transaction_data.category_id,
            profile.user_id,
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    merchant_id = transaction_data.merchant_id
    if merchant_id is None:
        merchant_name = extract_merchant_from_description(transaction_data.description)
        if merchant_name:
            merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
            merchant_id = merchant.id if merchant else None

    tx_id = await conn.fetchval(
        """INSERT INTO transactions
             (amount, description, transaction_type, account_id, category_id, merchant_id,
              bill_id, goal_id, is_pending, is_recurring, profile_id, date, notes, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual')
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
            await auto_link_transaction(tx_id, matched_bill["id"], conn, is_auto=True)
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

    if transaction_data.category_id is not None:
        cat = await conn.fetchrow(
            "SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)",
            transaction_data.category_id,
            profile.user_id,
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data = transaction_data.model_dump(exclude_unset=True)
    if update_data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(update_data)]
        await conn.execute(
            f"UPDATE transactions SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            transaction_id,
            profile.id,
            *update_data.values(),
        )

    row = await conn.fetchrow(_TX_JOIN + " WHERE t.id = $1", transaction_id)
    return _to_response(dict(row))


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
        """SELECT t.category_id, c.name AS category_name, c.color AS category_color,
                  SUM(t.amount) AS total_amount, COUNT(t.id) AS transaction_count
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
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
    amount: float | None
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
    amount: float | None = None


async def _preview_merchant_name(
    profile_id: int, raw_name: str | None, conn: asyncpg.Connection
) -> str | None:
    """D5: the parse preview shows the corrected merchant name ("Walmart") before
    anything saves, not the raw typo'd text ("wallmart") — read-only, creates nothing."""
    if not raw_name:
        return None
    match = await find_matching_merchant(profile_id, raw_name, conn)
    return match.name if match else raw_name


@router.post("/parse", response_model=ParseResponse)
async def parse_transaction_text(
    request: ParseRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    user_row = await conn.fetchrow(
        "SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id
    )
    ai_result = await ai_service.parse(request.text, cloud_enabled=user_row["ai_cloud_enabled"])

    if ai_result is not None:
        merchant_display = await _preview_merchant_name(profile.id, ai_result.merchant, conn)
        return ParseResponse(
            amount=ai_result.amount,
            description=ai_result.description,
            type=ai_result.transaction_type,
            category=ai_result.category,
            merchant=merchant_display,
            ai_provider="gemini",
            missing=["amount"] if ai_result.amount is None else [],
            raw_text=request.text,
        )

    result = parse_transaction(request.text)
    parsed_merchant = extract_merchant_from_description(result["description"])
    merchant_display = await _preview_merchant_name(profile.id, parsed_merchant, conn)
    return ParseResponse(
        amount=result["amount"],
        description=result["description"],
        type=result["type"],
        category=result["category"],
        merchant=merchant_display,
        date=datetime.combine(result["date"], datetime.min.time())
        if result["date_explicit"]
        else None,
        missing=result["missing"],
        raw_text=result["raw_text"],
    )


@router.post("/quick-add", response_model=TransactionResponse)
async def quick_add_transaction(
    request: QuickAddRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    user_row = await conn.fetchrow(
        "SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id
    )
    ai_result = await ai_service.parse(request.text, cloud_enabled=user_row["ai_cloud_enabled"])
    if ai_result is not None and ai_result.amount is not None:
        parsed_amount = ai_result.amount
        parsed_description = ai_result.description
        parsed_type = ai_result.transaction_type
        parsed_category = ai_result.category
        merchant_name = ai_result.merchant
        parsed_date = datetime.now()
    else:
        parsed = parse_transaction(request.text)

        if parsed["amount"] is None and request.amount is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not parse an amount from the text. Try something like 'spent 15 on groceries'.",
            )

        parsed_amount = parsed["amount"]
        parsed_description = parsed["description"]
        parsed_type = parsed["type"]
        parsed_category = parsed["category"]
        merchant_name = extract_merchant_from_description(parsed_description)
        if parsed["date_explicit"]:
            parsed_date = datetime.combine(parsed["date"], datetime.min.time())
        else:
            parsed_date = datetime.now()

    if request.amount is not None:
        parsed_amount = request.amount

    category_id = None
    if request.category_id is not None:
        cat = await conn.fetchrow(
            "SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)",
            request.category_id,
            profile.user_id,
        )
        if cat:
            category_id = cat["id"]
    elif parsed_category:
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

    merchant_id = None
    if merchant_name:
        merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
        merchant_id = merchant.id if merchant else None

    tx_id = await conn.fetchval(
        """INSERT INTO transactions
             (amount, description, transaction_type, account_id, category_id, merchant_id,
              profile_id, date, ai_categorized, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'quick_add')
           RETURNING id""",
        parsed_amount,
        parsed_description,
        parsed_type,
        default_account["id"],
        category_id,
        merchant_id,
        profile.id,
        parsed_date,
    )

    matched_bill = await suggest_bill_match(
        profile.id, parsed_description, parsed_amount, parsed_date, merchant_id, conn
    )
    if matched_bill:
        await auto_link_transaction(tx_id, matched_bill["id"], conn, is_auto=True)
        await conn.execute(
            "UPDATE transactions SET bill_id = $1 WHERE id = $2", matched_bill["id"], tx_id
        )

    row = await conn.fetchrow(_TX_JOIN + " WHERE t.id = $1", tx_id)
    return _to_response(dict(row))


class TransactionImport(BaseModel):
    amount: float = Field(gt=0)
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
    amount: float
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

    async with conn.transaction():
        for i, tx in enumerate(request.transactions):
            try:
                # The frontend sends `date.toISOString()` (tz-aware, UTC) but the
                # `transactions.date` column is `timestamp without time zone` — asyncpg
                # can't insert a tz-aware value into a naive column ("can't subtract
                # offset-naive and offset-aware datetimes"). Normalize once, up front.
                tx_date = tx.date.replace(tzinfo=None) if tx.date.tzinfo else tx.date
                merchant_id = tx.merchant_id
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
