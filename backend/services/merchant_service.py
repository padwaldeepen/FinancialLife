import re
from decimal import Decimal

import asyncpg

from database.models import Merchant

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


# Typo-tolerant matching thresholds (D5). Short normalized names get a tighter bound
# — "cvs" vs "cbs" (distance 1) are both plausible-but-different 3-letter merchants,
# so at short lengths only a distance of exactly 1 is trusted; longer names ("wallmart"
# vs "walmart") can tolerate up to 2.
FUZZY_MATCH_SHORT_NAME_LEN = 5
FUZZY_MATCH_SHORT_MAX_DISTANCE = 1
FUZZY_MATCH_MAX_DISTANCE = 2


def levenshtein_distance(a: str, b: str) -> int:
    """Classic O(len(a)*len(b)) edit-distance DP — small inputs (merchant names),
    no need for a library."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    prev_row = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr_row = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr_row[j] = min(
                prev_row[j] + 1,  # deletion
                curr_row[j - 1] + 1,  # insertion
                prev_row[j - 1] + cost,  # substitution
            )
        prev_row = curr_row
    return prev_row[len(b)]


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


def _row_to_merchant(row: asyncpg.Record) -> Merchant:
    return Merchant(**dict(row))


async def find_fuzzy_merchant(
    profile_id: int, name: str, conn: asyncpg.Connection
) -> Merchant | None:
    """Typo-tolerant match against the active profile's existing merchants only
    (never across profiles — architecture-and-goals.md). Call after an exact-match
    miss. Returns the closest merchant within the distance threshold, or None if
    nothing is close enough / the input is too short to trust a fuzzy match."""
    normalized = normalize_name(name)
    if not normalized:
        return None
    threshold = (
        FUZZY_MATCH_SHORT_MAX_DISTANCE
        if len(normalized) <= FUZZY_MATCH_SHORT_NAME_LEN
        else FUZZY_MATCH_MAX_DISTANCE
    )

    rows = await conn.fetch("SELECT * FROM merchants WHERE profile_id = $1", profile_id)
    best: tuple[Merchant, int] | None = None
    for row in rows:
        candidate = _row_to_merchant(row)
        distance = levenshtein_distance(normalized, candidate.normalized_name)
        if distance <= threshold and (best is None or distance < best[1]):
            best = (candidate, distance)
    return best[0] if best else None


async def find_matching_merchant(
    profile_id: int, name: str, conn: asyncpg.Connection
) -> Merchant | None:
    """Exact match, then typo-tolerant fallback. Read-only — never creates, so it's
    safe to call from a preview/parse path before anything is saved."""
    if not name:
        return None
    normalized = normalize_name(name)
    row = await conn.fetchrow(
        "SELECT * FROM merchants WHERE profile_id = $1 AND normalized_name = $2",
        profile_id,
        normalized,
    )
    if row:
        return _row_to_merchant(row)
    return await find_fuzzy_merchant(profile_id, name, conn)


async def find_or_create_merchant(
    profile_id: int, name: str, conn: asyncpg.Connection
) -> Merchant | None:
    if not name:
        return None

    existing = await find_matching_merchant(profile_id, name, conn)
    if existing:
        return existing

    normalized = normalize_name(name)
    row = await conn.fetchrow(
        """INSERT INTO merchants (profile_id, name, normalized_name)
           VALUES ($1, $2, $3) RETURNING *""",
        profile_id,
        name,
        normalized,
    )
    return _row_to_merchant(row)


async def get_merchants(
    profile_id: int, conn: asyncpg.Connection, include_hidden: bool = False
) -> list[dict]:
    """Returns dicts with transaction_count/total_spent joined in — not bare
    Merchant rows (rules/database.md: related data via JOIN, not attribute access)."""
    hidden_clause = "" if include_hidden else "AND m.is_hidden = FALSE"
    # Y7: the learned category is joined in by name so Manage -> Merchants can show the
    # rule in plain language ("Chipotle -> Dining Out") instead of an opaque id. Grouped
    # by c.name as well as m.id because it's a non-aggregated selected column.
    rows = await conn.fetch(
        f"""SELECT m.*,
               c.name AS default_category_name,
               COUNT(t.id) AS transaction_count,
               COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS total_spent
            FROM merchants m
            LEFT JOIN transactions t ON t.merchant_id = m.id
            LEFT JOIN categories c ON c.id = m.default_category_id
            WHERE m.profile_id = $1 {hidden_clause}
            GROUP BY m.id, c.name
            ORDER BY m.name""",
        profile_id,
    )
    return [dict(row) for row in rows]


async def get_merchant(
    merchant_id: int, profile_id: int, conn: asyncpg.Connection
) -> Merchant | None:
    row = await conn.fetchrow(
        "SELECT * FROM merchants WHERE id = $1 AND profile_id = $2",
        merchant_id,
        profile_id,
    )
    return _row_to_merchant(row) if row else None


async def update_merchant(
    merchant_id: int, profile_id: int, update_data: dict, conn: asyncpg.Connection
) -> dict | None:
    merchant = await get_merchant(merchant_id, profile_id, conn)
    if not merchant:
        return None

    data = dict(update_data)
    if "name" in data:
        data["normalized_name"] = normalize_name(data["name"])

    if data:
        set_clauses = [f"{field} = ${i + 3}" for i, field in enumerate(data)]
        await conn.execute(
            f"UPDATE merchants SET {', '.join(set_clauses)} WHERE id = $1 AND profile_id = $2",
            merchant_id,
            profile_id,
            *data.values(),
        )

    row = await conn.fetchrow(
        """SELECT m.*,
               COUNT(t.id) AS transaction_count,
               COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS total_spent
            FROM merchants m LEFT JOIN transactions t ON t.merchant_id = m.id
            WHERE m.id = $1 GROUP BY m.id""",
        merchant_id,
    )
    return dict(row) if row else None


async def delete_merchant(merchant_id: int, profile_id: int, conn: asyncpg.Connection) -> bool:
    result = await conn.execute(
        "DELETE FROM merchants WHERE id = $1 AND profile_id = $2",
        merchant_id,
        profile_id,
    )
    return result != "DELETE 0"


async def merge_merchants(
    target_id: int, source_ids: list[int], profile_id: int, conn: asyncpg.Connection
) -> dict | None:
    target = await get_merchant(target_id, profile_id, conn)
    if not target:
        return None

    aliases: list[str] = list(target.aliases or [])
    aliases.append(target.normalized_name)

    async with conn.transaction():
        for sid in source_ids:
            source = await get_merchant(sid, profile_id, conn)
            if not source:
                continue
            aliases.append(source.normalized_name)
            if source.aliases:
                aliases.extend(source.aliases)

            # `source` was already fetched via get_merchant(sid, profile_id, ...) above,
            # so this profile_id filter is currently redundant — added anyway to match
            # the "every financial write filters by profile_id" pattern used everywhere
            # else, so a future refactor that drops the pre-check can't silently reopen
            # a cross-profile write.
            await conn.execute(
                "UPDATE transactions SET merchant_id = $1 WHERE merchant_id = $2 AND profile_id = $3",
                target_id,
                sid,
                profile_id,
            )
            await conn.execute(
                "DELETE FROM merchants WHERE id = $1 AND profile_id = $2", sid, profile_id
            )

        await conn.execute(
            "UPDATE merchants SET aliases = $1 WHERE id = $2",
            list(set(aliases)),
            target_id,
        )

    row = await conn.fetchrow(
        """SELECT m.*,
               COUNT(t.id) AS transaction_count,
               COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS total_spent
            FROM merchants m LEFT JOIN transactions t ON t.merchant_id = m.id
            WHERE m.id = $1 GROUP BY m.id""",
        target_id,
    )
    return dict(row) if row else None


async def backfill_merchants(profile_id: int, conn: asyncpg.Connection) -> int:
    rows = await conn.fetch(
        "SELECT id, description FROM transactions WHERE profile_id = $1 AND merchant_id IS NULL",
        profile_id,
    )
    count = 0
    for row in rows:
        merchant_name = extract_merchant_from_description(row["description"])
        if merchant_name:
            merchant = await find_or_create_merchant(profile_id, merchant_name, conn)
            if merchant:
                await conn.execute(
                    "UPDATE transactions SET merchant_id = $1 WHERE id = $2",
                    merchant.id,
                    row["id"],
                )
                count += 1
    return count


async def get_merchant_summary(
    merchant_id: int, profile_id: int, conn: asyncpg.Connection
) -> dict | None:
    merchant = await get_merchant(merchant_id, profile_id, conn)
    if not merchant:
        return None

    txs = await conn.fetch(
        """SELECT t.id, t.amount, t.description, t.transaction_type, t.date,
                  c.name AS category_name, c.color AS category_color
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.merchant_id = $1
           ORDER BY t.date DESC""",
        merchant_id,
    )

    # Sum as Decimal throughout (matches the NUMERIC(12,2) columns), cast to float only
    # at the response boundary — repeated float(...) casts before summing/adding
    # reintroduce binary floating-point error (rules/database.md).
    expense_txs = [t for t in txs if t["transaction_type"] == "expense"]
    total_spent = float(sum((t["amount"] for t in expense_txs), Decimal("0")))
    total_income = float(
        sum((t["amount"] for t in txs if t["transaction_type"] == "income"), Decimal("0"))
    )

    dates = [t["date"] for t in txs]
    first_date = min(dates) if dates else None
    last_date = max(dates) if dates else None

    category_breakdown: dict[str, dict] = {}
    for t in expense_txs:
        cat_name = t["category_name"] or "Uncategorized"
        cat_color = t["category_color"] or "#6B7280"
        if cat_name not in category_breakdown:
            category_breakdown[cat_name] = {
                "category_name": cat_name,
                "color": cat_color,
                "total": Decimal("0"),
                "count": 0,
            }
        category_breakdown[cat_name]["total"] += t["amount"]
        category_breakdown[cat_name]["count"] += 1
    for entry in category_breakdown.values():
        entry["total"] = float(entry["total"])

    monthly_spending: dict[str, Decimal] = {}
    for t in expense_txs:
        key = t["date"].strftime("%Y-%m")
        monthly_spending[key] = monthly_spending.get(key, Decimal("0")) + t["amount"]

    monthly_chart = [
        {"month": k, "amount": float(round(v, 2))} for k, v in sorted(monthly_spending.items())
    ]

    recent_transactions = [
        {
            "id": t["id"],
            "amount": float(t["amount"]),
            "description": t["description"],
            "transaction_type": t["transaction_type"],
            "date": t["date"].isoformat(),
            "category_name": t["category_name"],
            "category_color": t["category_color"],
        }
        for t in txs[:20]
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


def name_similarity(a: str, b: str) -> float:
    """Jaccard word-overlap on normalized names, 0.0-1.0.

    The one implementation: merchant-vs-merchant matching (find_similar_merchants)
    and the import dedup gate (ingest/dedup.py) scored candidates with byte-identical
    copies of this, so a change to the heuristic only ever landed in one of them.
    """
    a_words = set(a.split())
    b_words = set(b.split())
    if not a_words or not b_words:
        return 0.0
    return len(a_words & b_words) / len(a_words | b_words)


async def find_similar_merchants(
    profile_id: int, conn: asyncpg.Connection, threshold: float = 0.6
) -> list[dict]:
    rows = await conn.fetch(
        """SELECT m.*,
               COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS total_spent
           FROM merchants m LEFT JOIN transactions t ON t.merchant_id = m.id
           WHERE m.profile_id = $1 AND m.is_hidden = FALSE
           GROUP BY m.id""",
        profile_id,
    )
    merchants = list(rows)

    pairs = []
    for i in range(len(merchants)):
        for j in range(i + 1, len(merchants)):
            a, b = merchants[i], merchants[j]
            similarity = name_similarity(a["normalized_name"], b["normalized_name"])
            if similarity >= threshold:
                pairs.append(
                    {
                        "merchant_a": {
                            "id": a["id"],
                            "name": a["name"],
                            "total_spent": float(a["total_spent"]),
                        },
                        "merchant_b": {
                            "id": b["id"],
                            "name": b["name"],
                            "total_spent": float(b["total_spent"]),
                        },
                        "similarity": round(similarity, 2),
                    }
                )

    pairs.sort(key=lambda p: p["similarity"], reverse=True)
    return pairs


async def get_valid_merchant_ids(profile_id: int, conn: asyncpg.Connection) -> set[int]:
    """Every merchant id belonging to this profile. Batch-fetch this once before a
    bulk import loop instead of one ownership query per row."""
    rows = await conn.fetch("SELECT id FROM merchants WHERE profile_id = $1", profile_id)
    return {r["id"] for r in rows}
