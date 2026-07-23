"""Recurring detection — architecture-and-goals.md "Recurring detection (Phase I
core)" / backlog.md I1. Pure functions over a list of transactions, no DB access —
the router (routers/insights.py) fetches transactions and passes them in, so this
stays independently testable and reusable by the forecast engine (I4).

Algorithm: group by merchant (falling back to normalized description when
merchant_id is NULL — salary deposits and similar income often has no merchant, and
income detection must still work for the forecast engine) and transaction_type
(income/expense kept separate — a group is one direction of money, never both).
Within a group: amount must be consistent (exact, or a single price-hike step, or
within +/-20% for variable bills) AND intervals must cluster around one of the
standard cadences. 3+ occurrences required. Anything that doesn't collapse into a
single stable pattern is rejected, not guessed at — this feeds forecasting and
reminders, so a false positive is worse than a missed one.
"""

import statistics
from dataclasses import dataclass
from datetime import date as date_type
from datetime import timedelta
from decimal import Decimal
from typing import Literal, TypedDict

MIN_OCCURRENCES = 3

# Exact-match tolerance for "same charge every time" — small enough to absorb cent
# rounding, not small enough to treat a real price change as noise.
EXACT_AMOUNT_TOLERANCE = Decimal("0.02")  # 2%
VARIABLE_AMOUNT_TOLERANCE = Decimal("0.20")  # 20% — utilities, variable bills

Cadence = Literal["weekly", "biweekly", "monthly", "quarterly", "yearly"]

# (target_days, tolerance_days) — the gap between consecutive occurrences must fall
# within tolerance of the target for every gap in the group, not just the average.
CADENCES: dict[Cadence, tuple[int, int]] = {
    "weekly": (7, 3),
    "biweekly": (14, 3),
    "monthly": (30, 5),
    "quarterly": (90, 10),
    "yearly": (365, 15),
}

# Monthly-equivalent ratios — same conversion the frontend uses for bills
# (shared/utils/money.ts), kept in sync deliberately: a $12/yr subscription and a
# $1/mo one should net the same "monthly cost" everywhere in the app.
_MONTHLY_RATIO: dict[Cadence, Decimal] = {
    "weekly": Decimal(52) / Decimal(12),
    "biweekly": Decimal(26) / Decimal(12),
    "monthly": Decimal(1),
    "quarterly": Decimal(1) / Decimal(3),
    "yearly": Decimal(1) / Decimal(12),
}


class TransactionInput(TypedDict):
    id: int
    merchant_id: int | None
    merchant_name: str | None
    description: str
    transaction_type: str
    amount: Decimal
    date: date_type


@dataclass
class RecurringCharge:
    group_key: str  # merchant_id as str, or "desc:<normalized description>"
    merchant_id: int | None
    display_name: str
    transaction_type: str
    is_subscription: bool  # exact-amount match (vs. a variable/utility bill)
    price_hike: bool
    avg_amount: Decimal  # the current/latest stable amount
    cadence: Cadence
    monthly_equivalent: Decimal
    next_expected_date: date_type
    occurrence_count: int
    confidence: float
    transaction_ids: list[int]


def _normalized_desc_key(description: str) -> str:
    import re

    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", description).strip().lower()
    return re.sub(r"\s+", " ", cleaned)


def _group_key(tx: TransactionInput) -> str:
    if tx["merchant_id"] is not None:
        return f"merchant:{tx['merchant_id']}"
    return f"desc:{_normalized_desc_key(tx['description'])}"


def _amount_pattern(
    amounts: list[Decimal],
) -> tuple[bool, bool, Decimal] | None:
    """Returns (is_subscription, price_hike, avg_amount) or None if the amounts
    don't collapse into any recognized recurring pattern."""
    if not amounts:
        return None

    mean = sum(amounts) / len(amounts)
    max_dev = max(abs(a - mean) / mean for a in amounts) if mean != 0 else Decimal(0)

    if max_dev <= EXACT_AMOUNT_TOLERANCE:
        return (True, False, mean)

    # Price-hike case: the trailing run of occurrences is internally exact, and
    # everything before that trailing run is also internally exact (or a single
    # occurrence) — one step change, not scattered noise. E.g. Netflix at $15.49
    # for a year, then $17.99 from last month on.
    trailing_value = amounts[-1]
    split = len(amounts)
    for i in range(len(amounts) - 1, -1, -1):
        if abs(amounts[i] - trailing_value) / trailing_value <= EXACT_AMOUNT_TOLERANCE:
            split = i
        else:
            break
    leading, trailing = amounts[:split], amounts[split:]
    if leading and trailing:
        leading_mean = sum(leading) / len(leading)
        leading_consistent = (
            max(abs(a - leading_mean) / leading_mean for a in leading) <= EXACT_AMOUNT_TOLERANCE
            if leading_mean != 0
            else True
        )
        hiked = abs(leading_mean - trailing_value) / leading_mean > EXACT_AMOUNT_TOLERANCE if leading_mean != 0 else False
        if leading_consistent and hiked:
            return (True, True, trailing_value)

    if max_dev <= VARIABLE_AMOUNT_TOLERANCE:
        return (False, False, mean)

    return None


def _best_cadence(dates: list[date_type]) -> Cadence | None:
    gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
    if not gaps:
        return None
    median_gap = statistics.median(gaps)

    best: Cadence | None = None
    best_diff = None
    for cadence, (target, tolerance) in CADENCES.items():
        if all(abs(g - target) <= tolerance for g in gaps):
            diff = abs(median_gap - target)
            if best_diff is None or diff < best_diff:
                best, best_diff = cadence, diff
    return best


def _confidence(occurrence_count: int, amounts_exact: bool, gaps_tight: bool) -> float:
    base = min(0.5 + 0.08 * (occurrence_count - MIN_OCCURRENCES), 0.9)
    if amounts_exact:
        base += 0.05
    if gaps_tight:
        base += 0.05
    return round(min(base, 1.0), 2)


def detect(transactions: list[TransactionInput]) -> list[RecurringCharge]:
    groups: dict[tuple[str, str], list[TransactionInput]] = {}
    for tx in transactions:
        key = (_group_key(tx), tx["transaction_type"])
        groups.setdefault(key, []).append(tx)

    results: list[RecurringCharge] = []
    for (group_key, tx_type), txs in groups.items():
        if len(txs) < MIN_OCCURRENCES:
            continue

        txs = sorted(txs, key=lambda t: t["date"])
        amounts = [t["amount"] for t in txs]
        dates = [t["date"] for t in txs]

        amount_pattern = _amount_pattern(amounts)
        if amount_pattern is None:
            continue
        is_subscription, price_hike, avg_amount = amount_pattern

        cadence = _best_cadence(dates)
        if cadence is None:
            continue

        target_days, tolerance = CADENCES[cadence]
        gaps_tight = all(
            abs((dates[i] - dates[i - 1]).days - target_days) <= tolerance // 2 + 1
            for i in range(1, len(dates))
        )

        merchant_id = txs[-1]["merchant_id"]
        display_name = txs[-1]["merchant_name"] or txs[-1]["description"]

        results.append(
            RecurringCharge(
                group_key=group_key,
                merchant_id=merchant_id,
                display_name=display_name,
                transaction_type=tx_type,
                is_subscription=is_subscription,
                price_hike=price_hike,
                avg_amount=avg_amount.quantize(Decimal("0.01")),
                cadence=cadence,
                monthly_equivalent=(avg_amount * _MONTHLY_RATIO[cadence]).quantize(Decimal("0.01")),
                next_expected_date=dates[-1] + timedelta(days=target_days),
                occurrence_count=len(txs),
                confidence=_confidence(len(txs), is_subscription and not price_hike, gaps_tight),
                transaction_ids=[t["id"] for t in txs],
            )
        )

    results.sort(key=lambda r: r.monthly_equivalent, reverse=True)
    return results
