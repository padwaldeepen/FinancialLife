from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import User
from database.session import get_db
from routers.auth import get_current_user
from services import goal_service

router = APIRouter()


class GoalCreate(BaseModel):
    name: str
    target_amount: float = Field(gt=0)
    type: Literal["save_up", "pay_down", "monthly_envelope"]
    current_amount: float = Field(default=0.0, ge=0)
    monthly_contribution: float | None = Field(default=None, gt=0)
    category_id: int | None = None
    deadline: date | None = None
    icon: str | None = None
    color: str | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: float | None = Field(default=None, gt=0)
    current_amount: float | None = Field(default=None, ge=0)
    monthly_contribution: float | None = Field(default=None, gt=0)
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
    target_amount: float
    current_amount: float
    monthly_contribution: float | None
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
    amount: float


def _to_response(goal) -> GoalResponse:
    progress_pct = (
        round((goal.current_amount / goal.target_amount) * 100, 1)
        if goal.target_amount > 0
        else 0.0
    )
    return GoalResponse(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        monthly_contribution=goal.monthly_contribution,
        type=goal.type,
        category_id=goal.category_id,
        category_name=goal.category.name if goal.category else None,
        deadline=goal.deadline.date() if goal.deadline else None,
        icon=goal.icon,
        color=goal.color,
        is_active=goal.is_active,
        sort_order=goal.sort_order,
        progress_pct=progress_pct,
        created_at=goal.created_at,
    )


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goals = await goal_service.get_goals(current_user.id, db)
    return [_to_response(g) for g in goals]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await goal_service.get_goal(goal_id, current_user.id, db)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _to_response(goal)


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await goal_service.create_goal(
        db,
        user_id=current_user.id,
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
    await db.commit()
    return _to_response(goal)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = goal_data.model_dump(exclude_unset=True)
    goal = await goal_service.update_goal(goal_id, current_user.id, update_data, db)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    await db.commit()
    return _to_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await goal_service.delete_goal(goal_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    await db.commit()


@router.post("/{goal_id}/contribute", response_model=GoalResponse)
async def contribute_to_goal(
    goal_id: int,
    body: ContributeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")
    goal = await goal_service.contribute_to_goal(goal_id, current_user.id, body.amount, db)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    await db.commit()
    return _to_response(goal)
