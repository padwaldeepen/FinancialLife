from datetime import date, datetime

import asyncpg

_GOAL_JOIN = """
    SELECT g.*, c.name AS category_name
    FROM goals g LEFT JOIN categories c ON c.id = g.category_id
"""


async def get_goals(profile_id: int, conn: asyncpg.Connection) -> list[dict]:
    rows = await conn.fetch(
        _GOAL_JOIN + " WHERE g.profile_id = $1 ORDER BY g.sort_order, g.created_at",
        profile_id,
    )
    return [dict(r) for r in rows]


async def get_goal(goal_id: int, profile_id: int, conn: asyncpg.Connection) -> dict | None:
    row = await conn.fetchrow(
        _GOAL_JOIN + " WHERE g.id = $1 AND g.profile_id = $2", goal_id, profile_id
    )
    return dict(row) if row else None


async def create_goal(
    conn: asyncpg.Connection,
    profile_id: int,
    name: str,
    target_amount: float,
    type: str,
    current_amount: float = 0.0,
    monthly_contribution: float | None = None,
    category_id: int | None = None,
    deadline: date | None = None,
    icon: str | None = None,
    color: str | None = None,
) -> dict:
    goal_id = await conn.fetchval(
        """INSERT INTO goals
             (profile_id, name, target_amount, current_amount, monthly_contribution,
              type, category_id, deadline, icon, color)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id""",
        profile_id,
        name,
        target_amount,
        current_amount,
        monthly_contribution,
        type,
        category_id,
        datetime.combine(deadline, datetime.min.time()) if deadline else None,
        icon,
        color,
    )
    return await get_goal(goal_id, profile_id, conn)


async def update_goal(
    goal_id: int, profile_id: int, update_data: dict, conn: asyncpg.Connection
) -> dict | None:
    existing = await get_goal(goal_id, profile_id, conn)
    if not existing:
        return None
    if update_data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(update_data)]
        await conn.execute(
            f"UPDATE goals SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            goal_id,
            profile_id,
            *update_data.values(),
        )
    return await get_goal(goal_id, profile_id, conn)


async def delete_goal(goal_id: int, profile_id: int, conn: asyncpg.Connection) -> bool:
    result = await conn.execute(
        "DELETE FROM goals WHERE id = $1 AND profile_id = $2", goal_id, profile_id
    )
    return result != "DELETE 0"


async def contribute_to_goal(
    goal_id: int, profile_id: int, amount: float, conn: asyncpg.Connection
) -> dict | None:
    existing = await get_goal(goal_id, profile_id, conn)
    if not existing:
        return None
    await conn.execute(
        "UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2 AND profile_id = $3",
        amount,
        goal_id,
        profile_id,
    )
    return await get_goal(goal_id, profile_id, conn)
