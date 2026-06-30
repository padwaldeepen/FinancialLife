from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Category, Transaction, User
from database.session import get_db
from routers.auth import get_current_user
from services import category_service

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    color: str = "#6B7280"
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    parent_id: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    color: str
    icon: str | None
    is_system: bool
    parent_id: int | None
    user_id: int | None
    children: list["CategoryResponse"] = []

    class Config:
        from_attributes = True


class CategorySpending(BaseModel):
    id: int
    name: str
    color: str
    total: float
    percentage: float
    transaction_count: int


@router.get("/spending", response_model=list[CategorySpending])
async def category_spending(
    days: int = Query(90, description="Number of days to look back"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.combine(date.today(), datetime.min.time())
    cutoff = cutoff.replace(day=max(1, cutoff.day - days))

    query = (
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
    )

    result = await db.execute(query)
    rows = result.all()

    grand_total = sum(r.total for r in rows) or 0

    spending = []
    for r in rows:
        cat_result = await db.execute(select(Category).where(Category.id == r.category_id))
        cat = cat_result.scalar_one_or_none()
        spending.append(
            CategorySpending(
                id=r.category_id,
                name=cat.name if cat else "Unknown",
                color=cat.color if cat else "#6B7280",
                total=round(r.total, 2),
                percentage=round((r.total / grand_total * 100), 1) if grand_total > 0 else 0,
                transaction_count=r.tx_count,
            )
        )

    spending.sort(key=lambda s: s.total, reverse=True)
    return spending


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    system_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if system_only:
        categories = await category_service.get_system_categories(db)
    else:
        categories = await category_service.get_categories_for_user(current_user.id, db)

    result = []
    for cat in categories:
        result.append(
            CategoryResponse(
                id=cat.id,
                name=cat.name,
                color=cat.color,
                icon=cat.icon,
                is_system=cat.is_system,
                parent_id=cat.parent_id,
                user_id=cat.user_id,
                children=[
                    CategoryResponse(
                        id=c.id,
                        name=c.name,
                        color=c.color,
                        icon=c.icon,
                        is_system=c.is_system,
                        parent_id=c.parent_id,
                        user_id=c.user_id,
                    )
                    for c in cat.children
                ],
            )
        )
    return result


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await category_service.get_category(category_id, current_user.id, db)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return CategoryResponse(
        id=category.id,
        name=category.name,
        color=category.color,
        icon=category.icon,
        is_system=category.is_system,
        parent_id=category.parent_id,
        user_id=category.user_id,
        children=[
            CategoryResponse(
                id=c.id,
                name=c.name,
                color=c.color,
                icon=c.icon,
                is_system=c.is_system,
                parent_id=c.parent_id,
                user_id=c.user_id,
            )
            for c in category.children
        ],
    )


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await category_service.create_category(
        current_user.id,
        category_data.name,
        category_data.color,
        category_data.parent_id,
        db,
    )
    await db.commit()
    await db.refresh(category)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        color=category.color,
        icon=category.icon,
        is_system=category.is_system,
        parent_id=category.parent_id,
        user_id=category.user_id,
    )


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = category_data.model_dump(exclude_unset=True)
    category = await category_service.update_category(category_id, current_user.id, update_data, db)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is system-managed",
        )
    await db.commit()
    await db.refresh(category)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        color=category.color,
        icon=category.icon,
        is_system=category.is_system,
        parent_id=category.parent_id,
        user_id=category.user_id,
    )


@router.get("/{category_id}/descendants")
async def get_category_descendants(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await category_service.get_category_descendants(category_id, current_user.id, db)
    return {"ids": ids}


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await category_service.delete_category(category_id, current_user.id, db)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is system-managed",
        )
    await db.commit()
