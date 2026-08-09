"""E2 — a refund is not income.

Returning a $60 jacket used to be imported as $60 of *income*, because the statement
parser classifies any credit row (trailing `-` or `CR`) as money in. That is wrong twice
over: Shopping still shows the $60 you no longer spent, and your income — and therefore
your savings rate — is inflated by a number you never earned. Every return quietly
skewed both.

A refund is stored as an **expense with a negative amount**, so it nets against the
original purchase in every aggregate that already sums signed amounts. See migration
0006 for why that beats adding a third `transaction_type`.

The hard part is telling a refund from real income, because both arrive as a credit.
The signal used here is that a refund has an *original*: a recent expense at the same
merchant for a similar amount. Payroll has no such twin. When no plausible original
exists the row stays income — declining to guess, the same rule E4 applied to currency.
"""

from datetime import date as date_type
from datetime import timedelta
from decimal import Decimal

import asyncpg

from services.merchant_service import normalize_name

# A return is usually processed days-to-weeks after the purchase — far wider than the
# dedup gate's 3 days, which is looking for the *same* transaction rather than its
# reversal. 90 days is the common retail returns window.
REFUND_LOOKBACK_DAYS = 90

# The refunded amount normally equals the original exactly; allow a small tolerance for
# partial restocking fees and for tax handled differently on the credit line.
REFUND_AMOUNT_TOLERANCE = Decimal("0.02")

# Words that mark a line as a reversal rather than part of the merchant's name. Stripped
# before matching so "ZARA RETURN" is compared as "zara".
_REFUND_WORDS = frozenset(
    {
        "return",
        "returns",
        "refund",
        "refunded",
        "credit",
        "reversal",
        "reversed",
        "adjustment",
        "chargeback",
        "rtn",
        "cr",
    }
)

# Containment, not Jaccard — and the difference decides whether this works at all.
# Jaccard divides by the *union*, so "zara return" vs "zara jacket" scores 1/3 = 0.33 and
# fails: it penalises the words that differ, when for a refund the differing word
# ("RETURN") is precisely the thing identifying it. What actually matters is whether the
# shorter name is contained in the longer one, which is what dividing by the smaller set
# measures. `name_similarity` stays Jaccard for merchant-vs-merchant dedup, where both
# sides are the same kind of string and length symmetry is the right assumption.
REFUND_NAME_THRESHOLD = 0.75


def _merchant_tokens(text: str) -> set[str]:
    return {w for w in normalize_name(text).split() if w not in _REFUND_WORDS}


def _containment(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


async def find_refund_original(
    profile_id: int,
    description: str,
    amount: Decimal,
    when: date_type,
    conn: asyncpg.Connection,
) -> asyncpg.Record | None:
    """The purchase this credit most plausibly reverses, or None.

    `amount` is the magnitude of the credit (positive). Matching is on merchant-name
    containment plus a near-equal amount within the returns window.
    """
    credit_tokens = _merchant_tokens(description)
    if not credit_tokens:
        return None

    candidates = await conn.fetch(
        """SELECT t.id, t.description, t.category_id, t.merchant_id, t.amount, t.date,
                  m.normalized_name AS merchant_normalized
             FROM transactions t
             LEFT JOIN merchants m ON m.id = t.merchant_id
            WHERE t.profile_id = $1
              AND t.transaction_type = 'expense'
              AND t.amount > 0
              AND t.date >= $2 AND t.date <= $3
              AND ABS(t.amount - $4) <= $5
              -- never let one purchase absorb two refunds
              AND NOT EXISTS (
                    SELECT 1 FROM transactions r WHERE r.refund_of_transaction_id = t.id
                  )
         ORDER BY t.date DESC""",
        profile_id,
        when - timedelta(days=REFUND_LOOKBACK_DAYS),
        # A credit can post a day *before* the purchase date on some statements.
        when + timedelta(days=1),
        amount,
        REFUND_AMOUNT_TOLERANCE,
    )

    best: asyncpg.Record | None = None
    best_score = 0.0
    for row in candidates:
        target = _merchant_tokens(row["merchant_normalized"] or row["description"])
        score = _containment(credit_tokens, target)
        if score > best_score:
            best, best_score = row, score

    return best if best_score >= REFUND_NAME_THRESHOLD else None
