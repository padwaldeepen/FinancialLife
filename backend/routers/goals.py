from datetime import date, datetime
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.money import Money
from database.models import MAX_MONEY_AMOUNT, Profile
from database.session import get_db
from routers.auth import get_current_profile
from services import goal_service

router = APIRouter()


class GoalCreate(BaseModel):
    name: str
    target_amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    type: Literal["save_up", "pay_down", "monthly_envelope"]
    current_amount: Decimal = Field(default=Decimal("0"), ge=0, le=MAX_MONEY_AMOUNT)
    monthly_contribution: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    category_id: int | None = None
    deadline: date | None = None
    icon: str | None = None
    color: str | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    current_amount: Decimal | None = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    monthly_contribution: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    type: Literal["save_up", "pay_down", "monthly_envelope"] | None = None
    category_id: int | None = None
    deadline: date | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class GoalResponse(BaseModel):
    id: int
    name: str
    target_amount: Money
    current_amount: Money
    monthly_contribution: Money | None
    type: str
    category_id: int | None
    category_name: str | None
    deadline: date | None
    icon: str | None
    color: str | None
    is_active: bool
    sort_order: int
    progress_pct: float
    created_at: datetime

    class Config:
        from_attributes = True


class ContributeRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)


def _to_response(goal: dict) -> GoalResponse:
    target = float(goal["target_amount"])
    current = float(goal["current_amount"])
    progress_pct = round((current / target) * 100, 1) if target > 0 else 0.0
    deadline = goal["deadline"]
    return GoalResponse(
        id=goal["id"],
        name=goal["name"],
        target_amount=target,
        current_amount=current,
        monthly_contribution=float(goal["monthly_contribution"])
        if goal["monthly_contribution"]
        else None,
        type=goal["type"],
        category_id=goal["category_id"],
        category_name=goal["category_name"],
        deadline=deadline.date() if deadline else None,
        icon=goal["icon"],
        color=goal["color"],
        is_active=goal["is_active"],
        sort_order=goal["sort_order"],
        progress_pct=progress_pct,
        created_at=goal["created_at"],
    )


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    goals = await goal_service.get_goals(profile.id, conn)
    return [_to_response(g) for g in goals]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    goal = await goal_service.get_goal(goal_id, profile.id, conn)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _to_response(goal)


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    goal = await goal_service.create_goal(
        conn,
        profile_id=profile.id,
        name=goal_data.name,
        target_amount=goal_data.target_amount,
        type=goal_data.type,
        current_amount=goal_data.current_amount,
        monthly_contribution=goal_data.monthly_contribution,
        category_id=goal_data.category_id,
        deadline=goal_data.deadline,
        icon=goal_data.icon,
        color=goal_data.color,
    )
    return _to_response(goal)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_data: GoalUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = goal_data.model_dump(exclude_unset=True)
    goal = await goal_service.update_goal(goal_id, profile.id, update_data, conn)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _to_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    deleted = await goal_service.delete_goal(goal_id, profile.id, conn)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")


@router.post("/{goal_id}/contribute", response_model=GoalResponse)
async def contribute_to_goal(
    goal_id: int,
    body: ContributeRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    goal = await goal_service.contribute_to_goal(goal_id, profile.id, body.amount, conn)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _to_response(goal)
