import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import Merchant, Transaction

ALIAS_MAP: dict[str, str] = {
    "amzn": "Amazon",
    "sbux": "Starbucks",
    "tgt": "Target",
    "wmt": "Walmart",
    "costco": "Costco",
    "hulu": "Hulu",
    "nflx": "Netflix",
    "spot": "Spotify",
    "uber": "Uber",
    "lyft": "Lyft",
    "doordash": "DoorDash",
    "grubhub": "Grubhub",
}


def normalize_name(raw: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", raw).strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def extract_merchant_from_description(description: str) -> str | None:
    desc_lower = description.lower().strip()

    for alias, full_name in ALIAS_MAP.items():
        if alias in desc_lower:
            return full_name

    keywords = [
        "uber",
        "lyft",
        "starbucks",
        "amazon",
        "netflix",
        "spotify",
        "walmart",
        "target",
        "costco",
        "doordash",
        "grubhub",
        "whole foods",
        "trader joe",
        "kroger",
        "safeway",
        "wawa",
        "shell",
        "exxon",
        "chevron",
        "bp",
        "7-eleven",
        "cvs",
        "walgreens",
        "mcdonald",
        "burger king",
        "wendy",
        "chipotle",
        "subway",
        "domino",
        "pizza hut",
        "panera",
    ]

    for kw in keywords:
        if kw in desc_lower:
            words = kw.split()
            return " ".join(w.capitalize() for w in words)

    return None


async def find_or_create_merchant(user_id: int, name: str, db: AsyncSession) -> Merchant | None:
    if not name:
        return None

    normalized = normalize_name(name)

    result = await db.execute(
        select(Merchant).where(
            Merchant.user_id == user_id,
            Merchant.normalized_name == normalized,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    merchant = Merchant(
        user_id=user_id,
        name=name,
        normalized_name=normalized,
    )
    db.add(merchant)
    await db.flush()
    return merchant


async def get_merchants(
    user_id: int, db: AsyncSession, include_hidden: bool = False
) -> list[Merchant]:
    stmt = (
        select(Merchant)
        .options(selectinload(Merchant.transactions))
        .where(Merchant.user_id == user_id)
    )
    if not include_hidden:
        stmt = stmt.where(Merchant.is_hidden.is_(False))
    stmt = stmt.order_by(Merchant.name)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_merchant(merchant_id: int, user_id: int, db: AsyncSession) -> Merchant | None:
    result = await db.execute(
        select(Merchant)
        .options(selectinload(Merchant.transactions))
        .where(Merchant.id == merchant_id, Merchant.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_merchant(
    merchant_id: int, user_id: int, update_data: dict, db: AsyncSession
) -> Merchant | None:
    merchant = await get_merchant(merchant_id, user_id, db)
    if not merchant:
        return None
    for field, value in update_data.items():
        setattr(merchant, field, value)
    if "name" in update_data:
        merchant.normalized_name = normalize_name(update_data["name"])
    await db.flush()
    return merchant


async def delete_merchant(merchant_id: int, user_id: int, db: AsyncSession) -> bool:
    merchant = await get_merchant(merchant_id, user_id, db)
    if not merchant:
        return False
    await db.delete(merchant)
    await db.flush()
    return True


async def merge_merchants(
    target_id: int, source_ids: list[int], user_id: int, db: AsyncSession
) -> Merchant | None:
    target = await get_merchant(target_id, user_id, db)
    if not target:
        return None

    aliases: list[str] = list(target.aliases or [])
    aliases.append(target.normalized_name)

    for sid in source_ids:
        source = await get_merchant(sid, user_id, db)
        if not source:
            continue
        aliases.append(source.normalized_name)
        if source.aliases:
            aliases.extend(source.aliases)

        result = await db.execute(select(Transaction).where(Transaction.merchant_id == sid))
        for tx in result.scalars().all():
            tx.merchant_id = target_id

        await db.delete(source)

    target.aliases = list(set(aliases))
    await db.flush()
    return target


async def backfill_merchants(user_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.merchant_id.is_(None),
        )
    )
    txs = result.scalars().all()
    count = 0
    for tx in txs:
        merchant_name = extract_merchant_from_description(tx.description)
        if merchant_name:
            merchant = await find_or_create_merchant(user_id, merchant_name, db)
            if merchant:
                tx.merchant_id = merchant.id
                count += 1
    await db.flush()
    return count


async def get_merchant_summary(merchant_id: int, user_id: int, db: AsyncSession) -> dict | None:
    merchant = await get_merchant(merchant_id, user_id, db)
    if not merchant:
        return None

    txs = merchant.transactions
    expense_txs = [t for t in txs if t.transaction_type == "expense"]
    total_spent = sum(t.amount for t in expense_txs)
    total_income = sum(t.amount for t in txs if t.transaction_type == "income")

    dates = [t.date for t in txs]
    first_date = min(dates) if dates else None
    last_date = max(dates) if dates else None

    category_breakdown: dict[str, dict] = {}
    for t in expense_txs:
        cat_name = t.category.name if t.category else "Uncategorized"
        cat_color = t.category.color if t.category else "#6B7280"
        if cat_name not in category_breakdown:
            category_breakdown[cat_name] = {
                "category_name": cat_name,
                "color": cat_color,
                "total": 0.0,
                "count": 0,
            }
        category_breakdown[cat_name]["total"] += t.amount
        category_breakdown[cat_name]["count"] += 1

    monthly_spending: dict[str, float] = {}
    for t in expense_txs:
        key = t.date.strftime("%Y-%m")
        monthly_spending[key] = monthly_spending.get(key, 0.0) + t.amount

    monthly_chart = [
        {"month": k, "amount": round(v, 2)} for k, v in sorted(monthly_spending.items())
    ]

    txs_sorted = sorted(txs, key=lambda t: t.date, reverse=True)
    recent_transactions = [
        {
            "id": t.id,
            "amount": t.amount,
            "description": t.description,
            "transaction_type": t.transaction_type,
            "date": t.date.isoformat(),
            "category_name": t.category.name if t.category else None,
            "category_color": t.category.color if t.category else None,
        }
        for t in txs_sorted[:20]
    ]

    return {
        "id": merchant.id,
        "name": merchant.name,
        "is_hidden": merchant.is_hidden,
        "total_spent": total_spent,
        "total_income": total_income,
        "transaction_count": len(txs),
        "first_transaction_date": first_date.isoformat() if first_date else None,
        "last_transaction_date": last_date.isoformat() if last_date else None,
        "category_breakdown": list(category_breakdown.values()),
        "monthly_spending": monthly_chart,
        "recent_transactions": recent_transactions,
    }


async def find_similar_merchants(
    user_id: int, db: AsyncSession, threshold: float = 0.6
) -> list[dict]:
    result = await db.execute(
        select(Merchant)
        .options(selectinload(Merchant.transactions))
        .where(Merchant.user_id == user_id, Merchant.is_hidden.is_(False))
    )
    merchants = result.scalars().all()

    pairs = []
    for i in range(len(merchants)):
        for j in range(i + 1, len(merchants)):
            a, b = merchants[i], merchants[j]
            similarity = _name_similarity(a.normalized_name, b.normalized_name)
            if similarity >= threshold:
                pairs.append(
                    {
                        "merchant_a": {
                            "id": a.id,
                            "name": a.name,
                            "total_spent": _merchant_total(a),
                        },
                        "merchant_b": {
                            "id": b.id,
                            "name": b.name,
                            "total_spent": _merchant_total(b),
                        },
                        "similarity": round(similarity, 2),
                    }
                )

    pairs.sort(key=lambda p: p["similarity"], reverse=True)
    return pairs


def _name_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    a_words = set(a.split())
    b_words = set(b.split())
    if not a_words or not b_words:
        return 0.0
    intersection = a_words & b_words
    union = a_words | b_words
    return len(intersection) / len(union)


def _merchant_total(merchant: Merchant) -> float:
    return sum(t.amount for t in merchant.transactions if t.transaction_type == "expense")
