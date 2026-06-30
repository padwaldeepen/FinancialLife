from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Goal


async def get_goals(user_id: int, db: AsyncSession) -> list[Goal]:
    result = await db.execute(
        select(Goal).where(Goal.user_id == user_id).order_by(Goal.sort_order, Goal.created_at)
    )
    return list(result.scalars().all())


async def get_goal(goal_id: int, user_id: int, db: AsyncSession) -> Goal | None:
    result = await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    return result.scalar_one_or_none()


async def create_goal(
    db: AsyncSession,
    user_id: int,
    name: str,
    target_amount: float,
    type: str,
    current_amount: float = 0.0,
    monthly_contribution: float | None = None,
    category_id: int | None = None,
    deadline: date | None = None,
    icon: str | None = None,
    color: str | None = None,
) -> Goal:
    goal = Goal(
        user_id=user_id,
        name=name,
        target_amount=target_amount,
        current_amount=current_amount,
        monthly_contribution=monthly_contribution,
        type=type,
        category_id=category_id,
        deadline=datetime.combine(deadline, datetime.min.time()) if deadline else None,
        icon=icon,
        color=color,
    )
    db.add(goal)
    await db.flush()
    return goal


async def update_goal(
    goal_id: int, user_id: int, update_data: dict, db: AsyncSession
) -> Goal | None:
    goal = await get_goal(goal_id, user_id, db)
    if not goal:
        return None
    for key, value in update_data.items():
        setattr(goal, key, value)
    await db.flush()
    return goal


async def delete_goal(goal_id: int, user_id: int, db: AsyncSession) -> bool:
    goal = await get_goal(goal_id, user_id, db)
    if not goal:
        return False
    await db.delete(goal)
    await db.flush()
    return True


async def contribute_to_goal(
    goal_id: int, user_id: int, amount: float, db: AsyncSession
) -> Goal | None:
    goal = await get_goal(goal_id, user_id, db)
    if not goal:
        return None
    goal.current_amount += amount
    await db.flush()
    return goal
