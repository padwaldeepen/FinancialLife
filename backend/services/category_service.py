import asyncpg

from database.models import Category

SYSTEM_CATEGORIES: list[dict] = [
    {
        "name": "Housing",
        "color": "#E11D48",
        "children": [
            {"name": "Rent", "color": "#FB7185"},
            {"name": "Mortgage", "color": "#FDA4AF"},
            {"name": "Insurance", "color": "#FECDD3"},
            {"name": "Repairs", "color": "#FFE4E6"},
        ],
    },
    {
        "name": "Food & Dining",
        "color": "#F59E0B",
        "children": [
            {"name": "Groceries", "color": "#FCD34D"},
            {"name": "Dining Out", "color": "#FDE68A"},
            {"name": "Coffee Shops", "color": "#FEF3C7"},
        ],
    },
    {
        "name": "Transportation",
        "color": "#3B82F6",
        "children": [
            {"name": "Gas", "color": "#60A5FA"},
            {"name": "Parking", "color": "#93C5FD"},
            {"name": "Public Transit", "color": "#BFDBFE"},
            {"name": "Rideshare", "color": "#DBEAFE"},
        ],
    },
    {
        "name": "Shopping",
        "color": "#8B5CF6",
        "children": [
            {"name": "Clothing", "color": "#A78BFA"},
            {"name": "Electronics", "color": "#C4B5FD"},
            {"name": "Home Goods", "color": "#DDD6FE"},
            {"name": "Online", "color": "#EDE9FE"},
        ],
    },
    {
        "name": "Entertainment",
        "color": "#EC4899",
        "children": [
            {"name": "Streaming", "color": "#F472B6"},
            {"name": "Games", "color": "#F9A8D4"},
            {"name": "Movies", "color": "#FBCFE8"},
            {"name": "Events", "color": "#FCE7F3"},
        ],
    },
    {
        "name": "Health & Fitness",
        "color": "#10B981",
        "children": [
            {"name": "Pharmacy", "color": "#34D399"},
            {"name": "Doctor", "color": "#6EE7B7"},
            {"name": "Gym", "color": "#A7F3D0"},
            {"name": "Insurance", "color": "#D1FAE5"},
        ],
    },
    {
        "name": "Bills & Utilities",
        "color": "#6B7280",
        "children": [
            {"name": "Electric", "color": "#9CA3AF"},
            {"name": "Water", "color": "#D1D5DB"},
            {"name": "Internet", "color": "#E5E7EB"},
            {"name": "Phone", "color": "#F3F4F6"},
        ],
    },
    {
        "name": "Income",
        "color": "#059669",
        "children": [
            {"name": "Salary", "color": "#34D399"},
            {"name": "Freelance", "color": "#6EE7B7"},
            {"name": "Gift", "color": "#A7F3D0"},
            {"name": "Refund", "color": "#D1FAE5"},
        ],
    },
]


def _row_to_category(row: asyncpg.Record) -> Category:
    return Category(**dict(row))


async def seed_system_categories(conn: asyncpg.Connection) -> None:
    existing_rows = await conn.fetch("SELECT name FROM categories WHERE is_system = TRUE")
    existing = {row["name"] for row in existing_rows}

    async with conn.transaction():
        for group in SYSTEM_CATEGORIES:
            if group["name"] in existing:
                continue

            parent_id = await conn.fetchval(
                """INSERT INTO categories (name, color, is_system, user_id)
                   VALUES ($1, $2, TRUE, NULL) RETURNING id""",
                group["name"],
                group["color"],
            )

            for child in group["children"]:
                await conn.execute(
                    """INSERT INTO categories (name, color, is_system, user_id, parent_id)
                       VALUES ($1, $2, TRUE, NULL, $3)""",
                    child["name"],
                    child["color"],
                    parent_id,
                )


async def get_categories_for_user(user_id: int, conn: asyncpg.Connection) -> list[Category]:
    rows = await conn.fetch(
        """SELECT * FROM categories
           WHERE user_id = $1 OR is_system = TRUE
           ORDER BY name""",
        user_id,
    )
    return [_row_to_category(row) for row in rows]


async def get_category(
    category_id: int, user_id: int | None, conn: asyncpg.Connection
) -> Category | None:
    if user_id is not None:
        row = await conn.fetchrow(
            """SELECT * FROM categories
               WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)""",
            category_id,
            user_id,
        )
    else:
        row = await conn.fetchrow("SELECT * FROM categories WHERE id = $1", category_id)
    return _row_to_category(row) if row else None


async def create_category(
    user_id: int, name: str, color: str, parent_id: int | None, conn: asyncpg.Connection
) -> Category:
    row = await conn.fetchrow(
        """INSERT INTO categories (name, color, user_id, parent_id, is_system)
           VALUES ($1, $2, $3, $4, FALSE) RETURNING *""",
        name,
        color,
        user_id,
        parent_id,
    )
    return _row_to_category(row)


async def update_category(
    category_id: int,
    user_id: int,
    update_data: dict,
    conn: asyncpg.Connection,
) -> Category | None:
    category = await get_category(category_id, user_id, conn)
    if not category or category.is_system:
        return None
    if not update_data:
        return category

    set_clauses = [f"{field} = ${i + 2}" for i, field in enumerate(update_data)]
    values = list(update_data.values())
    row = await conn.fetchrow(
        f"UPDATE categories SET {', '.join(set_clauses)} WHERE id = $1 RETURNING *",
        category_id,
        *values,
    )
    return _row_to_category(row)


async def delete_category(category_id: int, user_id: int, conn: asyncpg.Connection) -> bool:
    category = await get_category(category_id, user_id, conn)
    if not category or category.is_system:
        return False
    await conn.execute("DELETE FROM categories WHERE id = $1", category_id)
    return True


async def get_system_categories(conn: asyncpg.Connection) -> list[Category]:
    rows = await conn.fetch("SELECT * FROM categories WHERE is_system = TRUE ORDER BY name")
    return [_row_to_category(row) for row in rows]


async def get_category_descendants(
    category_id: int, user_id: int, conn: asyncpg.Connection
) -> list[int]:
    """Recursively get all descendant category IDs under the given category."""
    ids: list[int] = [category_id]
    rows = await conn.fetch(
        """SELECT id FROM categories
           WHERE parent_id = $1 AND (user_id = $2 OR is_system = TRUE)""",
        category_id,
        user_id,
    )
    for row in rows:
        ids.extend(await get_category_descendants(row["id"], user_id, conn))
    return ids


async def get_leaf_categories(user_id: int, conn: asyncpg.Connection) -> list[Category]:
    """Get all categories that have no children (leaf nodes)."""
    rows = await conn.fetch(
        """SELECT c.* FROM categories c
           WHERE (c.user_id = $1 OR c.is_system = TRUE)
             AND NOT EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = c.id)
           ORDER BY c.name""",
        user_id,
    )
    return [_row_to_category(row) for row in rows]
