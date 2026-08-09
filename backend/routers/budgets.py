from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.logging import get_logger
from core.money import Money
from database.models import MAX_MONEY_AMOUNT, Profile
from database.session import get_db
from routers.auth import get_current_profile
from services.transaction_service import check_category_owned, spent_in_period

log = get_logger(__name__)

router = APIRouter(deprecated=True)


class BudgetCreate(BaseModel):
    name: str
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    period: Literal["monthly", "weekly", "yearly"]
    category_id: int | None = None


class BudgetUpdate(BaseModel):
    name: str | None = None
    amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    period: Literal["monthly", "weekly", "yearly"] | None = None
    category_id: int | None = None
    is_active: bool | None = None


class BudgetResponse(BaseModel):
    id: int
    name: str
    amount: Money
    period: str
    category_id: int | None
    category_name: str | None
    category_color: str | None
    spent: Money
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


def _to_response(row: dict, spent: Decimal) -> BudgetResponse:
    return BudgetResponse(
        id=row["id"],
        name=row["name"],
        amount=row["amount"],
        period=row["period"],
        category_id=row["category_id"],
        category_name=row.get("category_name"),
        category_color=row.get("category_color"),
        spent=spent,
        is_active=row["is_active"],
        created_at=row["created_at"],
    )


_BUDGET_JOIN = """
    SELECT b.*, c.name AS category_name, c.color AS category_color
    FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
"""


@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    log.warning("Deprecated endpoint called: GET /api/budgets/")
    rows = await conn.fetch(_BUDGET_JOIN + " WHERE b.profile_id = $1", profile.id)

    period_ranges: dict[str, tuple[datetime, datetime]] = {}
    responses = []
    for row in rows:
        if row["period"] not in period_ranges:
            period_ranges[row["period"]] = get_period_range(row["period"])
        start, end = period_ranges[row["period"]]
        spent = await spent_in_period(profile.id, start, end, conn, row["category_id"])
        responses.append(_to_response(dict(row), spent))
    return responses


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_data: BudgetCreate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    await check_category_owned(budget_data.category_id, profile, conn)

    budget_id = await conn.fetchval(
        """INSERT INTO budgets (name, amount, period, category_id, profile_id, start_date, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id""",
        budget_data.name,
        budget_data.amount,
        budget_data.period,
        budget_data.category_id,
        profile.id,
        datetime.now(),
    )
    row = await conn.fetchrow(_BUDGET_JOIN + " WHERE b.id = $1", budget_id)
    start, end = get_period_range(row["period"])
    spent = await spent_in_period(profile.id, start, end, conn, row["category_id"])
    return _to_response(dict(row), spent)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    existing = await conn.fetchrow(
        "SELECT id FROM budgets WHERE id = $1 AND profile_id = $2", budget_id, profile.id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found")

    await check_category_owned(budget_data.category_id, profile, conn)

    update_data = budget_data.model_dump(exclude_unset=True)
    if update_data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(update_data)]
        await conn.execute(
            f"UPDATE budgets SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            budget_id,
            profile.id,
            *update_data.values(),
        )

    row = await conn.fetchrow(_BUDGET_JOIN + " WHERE b.id = $1", budget_id)
    start, end = get_period_range(row["period"])
    spent = await spent_in_period(profile.id, start, end, conn, row["category_id"])
    return _to_response(dict(row), spent)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    result = await conn.execute(
        "DELETE FROM budgets WHERE id = $1 AND profile_id = $2", budget_id, profile.id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Budget not found")


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        _BUDGET_JOIN + " WHERE b.id = $1 AND b.profile_id = $2", budget_id, profile.id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Budget not found")

    start, end = get_period_range(row["period"])
    spent = await spent_in_period(profile.id, start, end, conn, row["category_id"])
    return _to_response(dict(row), spent)
