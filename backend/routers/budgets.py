from datetime import datetime, timedelta
from warnings import warn

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.logging import get_logger
from database.models import Budget, Category, Transaction, User
from database.session import get_db
from routers.auth import get_current_user

log = get_logger(__name__)

DEPRECATION_NOTE = "DEPRECATED — will be removed in Phase 16. Replaced by Goals."

router = APIRouter(deprecated=True)

# Emit deprecation warning on import
warn(f"Budgets router is deprecated. {DEPRECATION_NOTE}", DeprecationWarning, stacklevel=2)

PERIOD_START_OVERRIDE: dict[str, int] = {}


class BudgetCreate(BaseModel):
    name: str
    amount: float
    period: str
    category_id: int | None = None


class BudgetUpdate(BaseModel):
    name: str | None = None
    amount: float | None = None
    period: str | None = None
    category_id: int | None = None
    is_active: bool | None = None


class BudgetResponse(BaseModel):
    id: int
    name: str
    amount: float
    period: str
    category_id: int | None
    category_name: str | None
    category_color: str | None
    spent: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


def get_period_range(period: str) -> tuple[datetime, datetime]:
    now = datetime.now()
    if period == "weekly":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = start - timedelta(days=start.weekday())
        end = start + timedelta(days=7)
    elif period == "yearly":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(
            year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            end = now.replace(year=now.year + 1, month=1, day=1)
        else:
            end = now.replace(month=now.month + 1, day=1)
    return start, end


async def _get_spent(user_id: int, start: datetime, end: datetime, db: AsyncSession) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == "expense",
            Transaction.date >= start,
            Transaction.date < end,
        )
    )
    return float(result.scalar())


@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log.warning("Deprecated endpoint called: GET /api/budgets/")
    result = await db.execute(
        select(Budget).options(joinedload(Budget.category)).where(Budget.user_id == current_user.id)
    )
    budgets = result.unique().scalars().all()

    period_budgets: dict[tuple[datetime, datetime], list[Budget]] = {}
    for budget in budgets:
        start, end = get_period_range(budget.period)
        key = (start, end)
        if key not in period_budgets:
            period_budgets[key] = []
        period_budgets[key].append(budget)

    spent_map: dict[int, float] = {}
    for (start, end), budget_list in period_budgets.items():
        result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == current_user.id,
                Transaction.transaction_type == "expense",
                Transaction.date >= start,
                Transaction.date < end,
            )
        )
        total = float(result.scalar())
        for budget in budget_list:
            spent_map[budget.id] = total

    response_list = []
    for budget in budgets:
        spent = spent_map.get(budget.id, 0.0)
        category = budget.category

        response_list.append(
            BudgetResponse(
                id=budget.id,
                name=budget.name,
                amount=budget.amount,
                period=budget.period,
                category_id=budget.category_id,
                category_name=category.name if category else None,
                category_color=category.color if category else None,
                spent=spent,
                is_active=budget.is_active,
                created_at=budget.created_at,
            )
        )

    return response_list


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = None
    if budget_data.category_id is not None:
        result = await db.execute(
            select(Category).where(
                Category.id == budget_data.category_id,
                Category.user_id == current_user.id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    db_budget = Budget(
        name=budget_data.name,
        amount=budget_data.amount,
        period=budget_data.period,
        category_id=budget_data.category_id,
        user_id=current_user.id,
        start_date=datetime.now(),
        is_active=True,
    )
    db.add(db_budget)
    await db.commit()
    await db.refresh(db_budget)

    start, end = get_period_range(db_budget.period)
    spent = await _get_spent(current_user.id, start, end, db)

    return BudgetResponse(
        id=db_budget.id,
        name=db_budget.name,
        amount=db_budget.amount,
        period=db_budget.period,
        category_id=db_budget.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        spent=spent,
        is_active=db_budget.is_active,
        created_at=db_budget.created_at,
    )


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget)
        .options(joinedload(Budget.category))
        .where(
            Budget.id == budget_id,
            Budget.user_id == current_user.id,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    if budget_data.category_id is not None:
        result = await db.execute(
            select(Category).where(
                Category.id == budget_data.category_id,
                Category.user_id == current_user.id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    await db.commit()
    await db.refresh(budget)

    start, end = get_period_range(budget.period)
    spent = await _get_spent(current_user.id, start, end, db)

    category = None
    if budget.category_id is not None:
        result = await db.execute(select(Category).where(Category.id == budget.category_id))
        category = result.scalar_one_or_none()

    return BudgetResponse(
        id=budget.id,
        name=budget.name,
        amount=budget.amount,
        period=budget.period,
        category_id=budget.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        spent=spent,
        is_active=budget.is_active,
        created_at=budget.created_at,
    )


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.user_id == current_user.id,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    await db.delete(budget)
    await db.commit()


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget)
        .options(joinedload(Budget.category))
        .where(
            Budget.id == budget_id,
            Budget.user_id == current_user.id,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    start, end = get_period_range(budget.period)
    spent = await _get_spent(current_user.id, start, end, db)

    category = budget.category

    return BudgetResponse(
        id=budget.id,
        name=budget.name,
        amount=budget.amount,
        period=budget.period,
        category_id=budget.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        spent=spent,
        is_active=budget.is_active,
        created_at=budget.created_at,
    )
