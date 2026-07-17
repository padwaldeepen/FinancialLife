"""The one dedup gate every import path (CSV, statement scan, receipt scan) runs
through — architecture-and-goals.md "Deduplication design". Pure functions plus one
DB lookup helper; no router wiring here (U4 and S3/S4 wire it into the actual import
flows and review-screen UI)."""

import hashlib
from dataclasses import dataclass, field
from datetime import date as date_type
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal

import asyncpg

from services.merchant_service import normalize_name

FUZZY_DATE_WINDOW_DAYS = 3
FUZZY_SIMILARITY_THRESHOLD = 0.5


def compute_import_hash(
    profile_id: int,
    account_id: int,
    tx_date: date_type,
    amount: Decimal,
    normalized_desc: str,
) -> str:
    """Deterministic fingerprint for exact-duplicate detection. Same profile +
    account + date + amount + normalized description -> same hash, regardless of
    which import path (CSV, scan) produced it."""
    quantized = amount.quantize(Decimal("0.01"))
    payload = f"{profile_id}|{account_id}|{tx_date.isoformat()}|{quantized}|{normalized_desc}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass
class DedupCandidate:
    profile_id: int
    account_id: int
    date: date_type
    amount: Decimal
    description: str
    merchant_name: str | None = None


@dataclass
class FuzzyMatch:
    transaction_id: int
    date: datetime
    amount: Decimal
    description: str
    merchant_name: str | None
    similarity: float


@dataclass
class DedupResult:
    status: Literal["exact", "fuzzy", "none"]
    import_hash: str
    exact_transaction_id: int | None = None
    fuzzy_matches: list[FuzzyMatch] = field(default_factory=list)


def _similarity(a: str, b: str) -> float:
    """Jaccard word-overlap on normalized names — same heuristic
    merchant_service.find_similar_merchants uses for merchant-vs-merchant matching,
    applied here to merchant/description text on a candidate vs. an existing row."""
    a_words = set(a.split())
    b_words = set(b.split())
    if not a_words or not b_words:
        return 0.0
    return len(a_words & b_words) / len(a_words | b_words)


async def find_duplicates(candidate: DedupCandidate, conn: asyncpg.Connection) -> DedupResult:
    """Exact match on import_hash short-circuits and returns immediately. Otherwise:
    same profile + same amount (never fuzzy on amount) + date within
    FUZZY_DATE_WINDOW_DAYS, scored by merchant/description similarity."""
    normalized_desc = normalize_name(candidate.merchant_name or candidate.description)
    import_hash = compute_import_hash(
        candidate.profile_id,
        candidate.account_id,
        candidate.date,
        candidate.amount,
        normalized_desc,
    )

    exact_id = await conn.fetchval(
        "SELECT id FROM transactions WHERE profile_id = $1 AND import_hash = $2 LIMIT 1",
        candidate.profile_id,
        import_hash,
    )
    if exact_id is not None:
        return DedupResult(status="exact", import_hash=import_hash, exact_transaction_id=exact_id)

    window_start = datetime.combine(candidate.date, datetime.min.time()) - timedelta(
        days=FUZZY_DATE_WINDOW_DAYS
    )
    window_end = datetime.combine(candidate.date, datetime.min.time()) + timedelta(
        days=FUZZY_DATE_WINDOW_DAYS + 1
    )

    rows = await conn.fetch(
        """SELECT t.id, t.date, t.amount, t.description, m.name AS merchant_name
           FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id
           WHERE t.profile_id = $1 AND t.amount = $2 AND t.date >= $3 AND t.date < $4""",
        candidate.profile_id,
        candidate.amount,
        window_start,
        window_end,
    )

    matches: list[FuzzyMatch] = []
    for row in rows:
        row_normalized = normalize_name(row["merchant_name"] or row["description"])
        score = _similarity(normalized_desc, row_normalized)
        if score >= FUZZY_SIMILARITY_THRESHOLD:
            matches.append(
                FuzzyMatch(
                    transaction_id=row["id"],
                    date=row["date"],
                    amount=row["amount"],
                    description=row["description"],
                    merchant_name=row["merchant_name"],
                    similarity=round(score, 2),
                )
            )

    matches.sort(key=lambda m: m.similarity, reverse=True)
    if matches:
        return DedupResult(status="fuzzy", import_hash=import_hash, fuzzy_matches=matches)
    return DedupResult(status="none", import_hash=import_hash)
