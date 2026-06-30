from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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


async def seed_system_categories(db: AsyncSession) -> None:
    result = await db.execute(select(Category.name).where(Category.is_system.is_(True)))
    existing = {row[0] for row in result.all()}

    for group in SYSTEM_CATEGORIES:
        if group["name"] in existing:
            continue

        parent = Category(
            name=group["name"],
            color=group["color"],
            is_system=True,
            user_id=None,
        )
        db.add(parent)
        await db.flush()

        for child_data in group["children"]:
            child = Category(
                name=child_data["name"],
                color=child_data["color"],
                is_system=True,
                user_id=None,
                parent_id=parent.id,
            )
            db.add(child)

    await db.commit()


async def get_categories_for_user(user_id: int, db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.children))
        .where((Category.user_id == user_id) | (Category.is_system.is_(True)))
        .order_by(Category.name)
    )
    return result.scalars().all()


async def get_category(category_id: int, user_id: int | None, db: AsyncSession) -> Category | None:
    stmt = select(Category).where(Category.id == category_id)
    if user_id is not None:
        stmt = stmt.where((Category.user_id == user_id) | (Category.is_system.is_(True)))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_category(
    user_id: int, name: str, color: str, parent_id: int | None, db: AsyncSession
) -> Category:
    category = Category(
        name=name,
        color=color,
        user_id=user_id,
        parent_id=parent_id,
        is_system=False,
    )
    db.add(category)
    await db.flush()
    return category


async def update_category(
    category_id: int,
    user_id: int,
    update_data: dict,
    db: AsyncSession,
) -> Category | None:
    category = await get_category(category_id, user_id, db)
    if not category or category.is_system:
        return None
    for field, value in update_data.items():
        setattr(category, field, value)
    await db.flush()
    return category


async def delete_category(category_id: int, user_id: int, db: AsyncSession) -> bool:
    category = await get_category(category_id, user_id, db)
    if not category or category.is_system:
        return False
    await db.delete(category)
    await db.flush()
    return True


async def get_system_categories(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.children))
        .where(Category.is_system.is_(True))
        .order_by(Category.name)
    )
    return result.scalars().all()


async def get_category_descendants(category_id: int, user_id: int, db: AsyncSession) -> list[int]:
    """Recursively get all descendant category IDs under the given category."""
    ids: list[int] = [category_id]
    result = await db.execute(
        select(Category.id).where(
            Category.parent_id == category_id,
            (Category.user_id == user_id) | (Category.is_system.is_(True)),
        )
    )
    child_ids = result.scalars().all()
    for child_id in child_ids:
        descendant_ids = await get_category_descendants(child_id, user_id, db)
        ids.extend(descendant_ids)
    return ids


async def get_leaf_categories(user_id: int, db: AsyncSession) -> list[Category]:
    """Get all categories that have no children (leaf nodes)."""
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.children))
        .where(
            (Category.user_id == user_id) | (Category.is_system.is_(True)),
        )
        .order_by(Category.name)
    )
    all_cats = result.scalars().all()
    return [c for c in all_cats if not c.children]
