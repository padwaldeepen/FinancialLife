from datetime import date, datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from database.models import Profile, User
from database.session import get_db
from routers.auth import get_current_profile, get_current_user
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


def _to_response(cat, children: list | None = None) -> CategoryResponse:
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        color=cat.color,
        icon=cat.icon,
        is_system=cat.is_system,
        parent_id=cat.parent_id,
        user_id=cat.user_id,
        children=[_to_response(c) for c in children] if children else [],
    )


def _build_tree(categories: list) -> list[CategoryResponse]:
    by_parent: dict[int | None, list] = {}
    for cat in categories:
        by_parent.setdefault(cat.parent_id, []).append(cat)

    def build(cat) -> CategoryResponse:
        return _to_response(cat, by_parent.get(cat.id, []))

    return [build(c) for c in categories if c.parent_id is None]


@router.get("/spending", response_model=list[CategorySpending])
async def category_spending(
    days: int = Query(90, description="Number of days to look back"),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    cutoff = datetime.combine(date.today(), datetime.min.time())
    cutoff = cutoff.replace(day=max(1, cutoff.day - days))

    rows = await conn.fetch(
        """SELECT t.category_id, c.name, c.color,
                  SUM(t.amount) AS total, COUNT(t.id) AS tx_count
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.category_id IS NOT NULL AND t.date >= $2
           GROUP BY t.category_id, c.name, c.color""",
        profile.id,
        cutoff,
    )

    grand_total = sum(float(r["total"]) for r in rows) or 0

    spending = [
        CategorySpending(
            id=r["category_id"],
            name=r["name"] or "Unknown",
            color=r["color"] or "#6B7280",
            total=round(float(r["total"]), 2),
            percentage=round((float(r["total"]) / grand_total * 100), 1) if grand_total > 0 else 0,
            transaction_count=r["tx_count"],
        )
        for r in rows
    ]
    spending.sort(key=lambda s: s.total, reverse=True)
    return spending


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    system_only: bool = False,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    if system_only:
        categories = await category_service.get_system_categories(conn)
    else:
        categories = await category_service.get_categories_for_user(current_user.id, conn)
    return _build_tree(categories)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    category = await category_service.get_category(category_id, current_user.id, conn)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    all_cats = await category_service.get_categories_for_user(current_user.id, conn)
    children = [c for c in all_cats if c.parent_id == category.id]
    return _to_response(category, children)


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    category = await category_service.create_category(
        current_user.id,
        category_data.name,
        category_data.color,
        category_data.parent_id,
        conn,
    )
    return _to_response(category)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = category_data.model_dump(exclude_unset=True)
    category = await category_service.update_category(
        category_id, current_user.id, update_data, conn
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is system-managed",
        )
    return _to_response(category)


@router.get("/{category_id}/descendants")
async def get_category_descendants(
    category_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    ids = await category_service.get_category_descendants(category_id, current_user.id, conn)
    return {"ids": ids}


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    deleted = await category_service.delete_category(category_id, current_user.id, conn)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is system-managed",
        )
