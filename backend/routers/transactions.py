from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database.models import Account, Category, Transaction, User
from database.session import get_db
from routers.auth import get_current_user
from services.transaction_service import parse_transaction

router = APIRouter()


class TransactionCreate(BaseModel):
    amount: float
    description: str
    transaction_type: str
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
    amount: float | None = None
    description: str | None = None
    transaction_type: str | None = None
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
    category_id: int | None
    category_name: str | None
    category_color: str | None
    merchant_id: int | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool = False
    is_recurring: bool = False
    date: datetime
    notes: str | None
    ai_categorized: bool
    created_at: datetime

    class Config:
        from_attributes = True


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = None
    if transaction_data.category_id is not None:
        result = await db.execute(
            select(Category).where(
                Category.id == transaction_data.category_id,
                Category.user_id == current_user.id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    db_transaction = Transaction(
        amount=transaction_data.amount,
        description=transaction_data.description,
        transaction_type=transaction_data.transaction_type,
        account_id=transaction_data.account_id,
        category_id=transaction_data.category_id,
        merchant_id=transaction_data.merchant_id,
        bill_id=transaction_data.bill_id,
        goal_id=transaction_data.goal_id,
        is_pending=transaction_data.is_pending,
        is_recurring=transaction_data.is_recurring,
        user_id=current_user.id,
        date=transaction_data.date,
        notes=transaction_data.notes,
    )

    db.add(db_transaction)
    await db.commit()
    await db.refresh(db_transaction)

    return TransactionResponse(
        id=db_transaction.id,
        amount=db_transaction.amount,
        description=db_transaction.description,
        transaction_type=db_transaction.transaction_type,
        account_id=db_transaction.account_id,
        category_id=db_transaction.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        date=db_transaction.date,
        notes=db_transaction.notes,
        is_pending=db_transaction.is_pending,
        is_recurring=db_transaction.is_recurring,
        ai_categorized=db_transaction.ai_categorized,
        created_at=db_transaction.created_at,
    )


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.user_id == current_user.id)
    )

    if transaction_type:
        stmt = stmt.where(Transaction.transaction_type == transaction_type)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if start_date:
        stmt = stmt.where(Transaction.date >= start_date)
    if end_date:
        stmt = stmt.where(Transaction.date <= end_date)
    if search:
        stmt = stmt.where(Transaction.description.ilike(f"%{search}%"))

    allowed_sort_columns = {"date", "amount", "description", "created_at", "transaction_type"}
    if sort_by not in allowed_sort_columns:
        sort_by = "date"
    sort_column = getattr(Transaction, sort_by)
    if sort_order == "asc":
        stmt = stmt.order_by(sort_column.asc())
    else:
        stmt = stmt.order_by(sort_column.desc())

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    transactions = result.unique().scalars().all()

    response_list = []
    for transaction in transactions:
        category = transaction.category

        response_list.append(
            TransactionResponse(
                id=transaction.id,
                amount=transaction.amount,
                description=transaction.description,
                transaction_type=transaction.transaction_type,
                account_id=transaction.account_id,
                category_id=transaction.category_id,
                category_name=category.name if category else None,
                category_color=category.color if category else None,
                date=transaction.date,
                notes=transaction.notes,
                ai_categorized=transaction.ai_categorized,
                created_at=transaction.created_at,
            )
        )

    return response_list


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    category = transaction.category

    return TransactionResponse(
        id=transaction.id,
        amount=transaction.amount,
        description=transaction.description,
        transaction_type=transaction.transaction_type,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        date=transaction.date,
        notes=transaction.notes,
        merchant_id=transaction.merchant_id,
        bill_id=transaction.bill_id,
        goal_id=transaction.goal_id,
        is_pending=transaction.is_pending,
        is_recurring=transaction.is_recurring,
        ai_categorized=transaction.ai_categorized,
        created_at=transaction.created_at,
    )


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    category = transaction.category

    if transaction_data.category_id is not None:
        result = await db.execute(
            select(Category).where(
                Category.id == transaction_data.category_id,
                Category.user_id == current_user.id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data = transaction_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    await db.commit()
    await db.refresh(transaction)

    if transaction.category_id:
        result = await db.execute(select(Category).where(Category.id == transaction.category_id))
        category = result.scalar_one_or_none()

    return TransactionResponse(
        id=transaction.id,
        amount=transaction.amount,
        description=transaction.description,
        transaction_type=transaction.transaction_type,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        date=transaction.date,
        notes=transaction.notes,
        merchant_id=transaction.merchant_id,
        bill_id=transaction.bill_id,
        goal_id=transaction.goal_id,
        is_pending=transaction.is_pending,
        is_recurring=transaction.is_recurring,
        ai_categorized=transaction.ai_categorized,
        created_at=transaction.created_at,
    )


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == current_user.id
        )
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await db.delete(transaction)
    await db.commit()

    return {"message": "Transaction deleted successfully"}


@router.get(
    "/summary/dashboard",
    response_model=DashboardSummary,
    deprecated=True,
    description="DEPRECATED — will be replaced by account-based endpoints in Phase 6 (Home screen).",
)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "income",
            Transaction.date >= start_of_month,
        )
    )
    income_result = result.scalar() or 0

    result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
            Transaction.date >= start_of_month,
        )
    )
    expense_result = result.scalar() or 0

    category_rows = await db.execute(
        select(
            Transaction.category_id,
            Category.name.label("category_name"),
            Category.color.label("category_color"),
            func.sum(Transaction.amount).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
            Transaction.date >= start_of_month,
        )
        .group_by(Transaction.category_id, Category.name, Category.color)
    )
    category_summaries = category_rows.all()

    formatted_summaries = []
    for summary in category_summaries:
        formatted_summaries.append(
            CategorySummary(
                category_id=summary.category_id,
                category_name=summary.category_name or "Uncategorized",
                category_color=summary.category_color or "#6B7280",
                total_amount=float(summary.total_amount),
                transaction_count=summary.transaction_count,
            )
        )

    recent_result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc())
        .limit(10)
    )
    recent_transactions = recent_result.unique().scalars().all()

    formatted_transactions = []
    for transaction in recent_transactions:
        category = transaction.category

        formatted_transactions.append(
            TransactionResponse(
                id=transaction.id,
                amount=transaction.amount,
                description=transaction.description,
                transaction_type=transaction.transaction_type,
                account_id=transaction.account_id,
                category_id=transaction.category_id,
                category_name=category.name if category else None,
                category_color=category.color if category else None,
                date=transaction.date,
                notes=transaction.notes,
                ai_categorized=transaction.ai_categorized,
                created_at=transaction.created_at,
            )
        )

    return DashboardSummary(
        total_income=float(income_result),
        total_expenses=float(expense_result),
        net_amount=float(income_result - expense_result),
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
    raw_text: str


class QuickAddRequest(BaseModel):
    text: str


@router.post("/parse", response_model=ParseResponse)
async def parse_transaction_text(request: ParseRequest):
    result = parse_transaction(request.text)
    return ParseResponse(
        amount=result["amount"],
        description=result["description"],
        type=result["type"],
        category=result["category"],
        raw_text=result["raw_text"],
    )


@router.post("/quick-add", response_model=TransactionResponse)
async def quick_add_transaction(
    request: QuickAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parsed = parse_transaction(request.text)

    if parsed["amount"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse an amount from the text. Try something like 'spent 15 on groceries'.",
        )

    category = None
    if parsed["category"]:
        result = await db.execute(
            select(Category).where(
                Category.name == parsed["category"],
                Category.user_id == current_user.id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            category = Category(
                name=parsed["category"],
                user_id=current_user.id,
            )
            db.add(category)
            await db.flush()

    account_result = await db.execute(
        select(Account)
        .where(
            Account.user_id == current_user.id,
            Account.is_active,
        )
        .order_by(Account.sort_order)
        .limit(1)
    )
    default_account = account_result.scalar_one_or_none()
    if not default_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active account found. Create an account first.",
        )

    transaction = Transaction(
        amount=parsed["amount"],
        description=parsed["description"],
        transaction_type=parsed["type"],
        account_id=default_account.id,
        category_id=category.id if category else None,
        user_id=current_user.id,
        date=datetime.now(),
        ai_categorized=True,
    )

    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return TransactionResponse(
        id=transaction.id,
        amount=transaction.amount,
        description=transaction.description,
        transaction_type=transaction.transaction_type,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        date=transaction.date,
        notes=transaction.notes,
        merchant_id=transaction.merchant_id,
        bill_id=transaction.bill_id,
        goal_id=transaction.goal_id,
        is_pending=transaction.is_pending,
        is_recurring=transaction.is_recurring,
        ai_categorized=transaction.ai_categorized,
        created_at=transaction.created_at,
    )
