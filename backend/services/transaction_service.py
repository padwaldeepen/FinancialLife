import re
from datetime import date, timedelta
from decimal import Decimal

import asyncpg
from fastapi import HTTPException, status

from database.models import Profile
from services.account_service import get_account
from services.bill_service import get_bill
from services.goal_service import get_goal
from services.merchant_service import get_merchant

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Food & Dining": [
        "grocery",
        "groceries",
        "food",
        "restaurant",
        "cafe",
        "coffee",
        "lunch",
        "dinner",
        "breakfast",
        "pizza",
        "burger",
        "sushi",
        "takeaway",
        "delivery",
        "zomato",
        "swiggy",
        "ubereats",
    ],
    "Transportation": [
        "uber",
        "lyft",
        "taxi",
        "cab",
        "bus",
        "train",
        "metro",
        "fuel",
        "gas",
        "petrol",
        "diesel",
        "parking",
        "toll",
        "flight",
        "airline",
        "ola",
    ],
    "Shopping": [
        "amazon",
        "flipkart",
        "mall",
        "clothes",
        "shoes",
        "electronics",
        "store",
        "shop",
        "online",
        "purchase",
        "bought",
    ],
    "Entertainment": [
        "netflix",
        "prime",
        "hotstar",
        "spotify",
        "youtube",
        "movie",
        "cinema",
        "ticket",
        "concert",
        "game",
        "gaming",
        "subscription",
    ],
    "Bills & Utilities": [
        "electricity",
        "water",
        "gas bill",
        "internet",
        "phone",
        "mobile",
        "recharge",
        "bill",
        "utility",
        "broadband",
    ],
    "Health & Fitness": [
        "doctor",
        "hospital",
        "clinic",
        "medicine",
        "pharmacy",
        "gym",
        "fitness",
        "health",
        "dentist",
        "checkup",
    ],
    "Income": [
        "salary",
        "income",
        "received",
        "earned",
        "deposit",
        "freelance",
        "payment",
        "refund",
        "return",
    ],
}

_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _previous_weekday(today: date, weekday: int) -> date:
    delta = (today.weekday() - weekday) % 7
    return today - timedelta(days=delta or 7)


def _extract_date(text: str, today: date) -> tuple[date, bool, str]:
    """Resolve a date phrase in the text.

    Returns (resolved_date, was_explicit, text_with_phrase_removed).
    No phrase found -> (today, False, text).
    """
    lowered = text.lower()

    # "day before yesterday" must match before "yesterday"
    fixed_phrases: list[tuple[str, date]] = [
        (r"\bday\s+before\s+yesterday\b", today - timedelta(days=2)),
        (r"\byesterday\b", today - timedelta(days=1)),
        (r"\btoday\b", today),
    ]
    for pattern, resolved in fixed_phrases:
        match = re.search(pattern, lowered)
        if match:
            return resolved, True, (text[: match.start()] + text[match.end() :]).strip()

    match = re.search(r"\b(\d+)\s+days?\s+ago\b", lowered)
    if match:
        resolved = today - timedelta(days=int(match.group(1)))
        return resolved, True, (text[: match.start()] + text[match.end() :]).strip()

    weekday_names = "|".join(_WEEKDAYS)
    match = re.search(rf"\b(?:last\s+|on\s+)?({weekday_names})\b", lowered)
    if match:
        resolved = _previous_weekday(today, _WEEKDAYS[match.group(1)])
        return resolved, True, (text[: match.start()] + text[match.end() :]).strip()

    # "on the 1st" / "on the 23rd" -> that day of this month (or last month if future)
    match = re.search(r"\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b", lowered)
    if match:
        day = int(match.group(1))
        year, month = today.year, today.month
        if day > today.day:
            month -= 1
            if month == 0:
                month, year = 12, year - 1
        try:
            resolved = date(year, month, day)
        except ValueError:
            resolved = today
        return resolved, True, (text[: match.start()] + text[match.end() :]).strip()

    # "on jul 3" / "july 3" -> that date this year (or last year if future)
    month_names = "|".join(_MONTHS)
    match = re.search(rf"\b(?:on\s+)?({month_names})[a-z]*\s+(\d{{1,2}})\b", lowered)
    if match:
        month, day = _MONTHS[match.group(1)], int(match.group(2))
        year = today.year
        try:
            resolved = date(year, month, day)
            if resolved > today:
                resolved = date(year - 1, month, day)
        except ValueError:
            resolved = today
        return resolved, True, (text[: match.start()] + text[match.end() :]).strip()

    return today, False, text


def _extract_amount(text: str) -> Decimal | None:
    patterns = [
        r"(?:spent|paid|sent|used|gave|cost|spend|spending)\s*\$?\s*([\d]+(?:\.\d{1,2})?)",
        r"\$?\s*([\d]+(?:\.\d{1,2})?)\s*(?:dollars|bucks|rs|rupees)?\s*(?:on|for|at|in|to)",
        r"(?:^|[^a-z])\$?\s*([\d]+(?:\.\d{1,2})?)\s*(?:dollars|bucks|rs|rupees)?(?:$|[^a-z])",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return Decimal(match.group(1))

    return None


def _extract_description(text: str, amount: Decimal | None) -> str:
    if amount is None:
        cleaned = text.strip()
    else:
        amount_literal = (
            f"{amount:.2f}" if amount != amount.to_integral_value() else str(int(amount))
        )
        # Replace the matched amount phrase with a single space, not "" — removing it
        # outright mashes the words on either side together (e.g. "parking 12
        # transport" -> "parkingtransport" instead of "parking transport"). The
        # trailing preposition alternation also needs a \b: without one it matches as
        # a bare substring ("in" inside "income"), silently eating real letters
        # ("freelance payment 800 income" -> "...paymentcome").
        cleaned = re.sub(
            r"(?:spent|paid|sent|used|gave|cost|spend|spending)?\s*\$?\s*"
            + re.escape(amount_literal)
            + r"\s*(?:dollars|bucks|rs|rupees)?\s*(?:(?:on|for|at|in|to)\b|:)?\s*",
            " ",
            text,
            flags=re.IGNORECASE,
        ).strip()
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Remove leading noise words
    noise = r"^(?:spent|paid|sent|used|gave|bought|got|received|earned)\s+"
    cleaned = re.sub(noise, "", cleaned, flags=re.IGNORECASE).strip()

    # Remove leading/trailing prepositions left over from date-phrase removal
    cleaned = re.sub(r"\s+(?:on|for|at|in|to|with)$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^(?:on|for|at|in|to|with)\s+", "", cleaned, flags=re.IGNORECASE).strip()

    return cleaned if cleaned else text.strip()


def _determine_type(description: str) -> str:
    income_keywords = ["salary", "received", "earned", "income", "deposit", "refund", "freelance"]
    for kw in income_keywords:
        if kw in description.lower():
            return "income"
    return "expense"


def _capitalize_first_letter(text: str) -> str:
    """Uppercase the first alphabetic character only — unlike str.capitalize(), never
    lowercases the rest, so proper nouns ("Starbucks", "Olive Garden") survive intact."""
    for i, ch in enumerate(text):
        if ch.isalpha():
            return text[:i] + ch.upper() + text[i + 1 :]
    return text


def categorize(description: str, transaction_type: str) -> str | None:
    if transaction_type == "income":
        return "Income"

    desc_lower = description.lower()
    best_match = None
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in desc_lower:
                score = len(kw)
                if score > best_score:
                    best_score = score
                    best_match = category

    return best_match


def parse_transaction(text: str, today: date | None = None) -> dict:
    """Parse free text into a structured transaction candidate.

    Contract (see docs/backlog.md T1):
    - amount is Decimal or None — never float
    - date phrases ("yesterday", "last friday", "on the 1st") resolve to real dates;
      no phrase -> today
    - a missing amount is NOT an error: returns missing=["amount"] with whatever was
      recognized, so the UI can ask its one follow-up question
    - garbage input: missing includes "description" as well
    """
    today = today or date.today()
    resolved_date, date_explicit, remaining = _extract_date(text, today)

    amount = _extract_amount(remaining)
    description = _extract_description(remaining, amount)
    transaction_type = _determine_type(description)
    category = categorize(description, transaction_type)

    missing: list[str] = []
    if amount is None:
        missing.append("amount")
    if not re.search(r"[a-zA-Z]", description):
        missing.append("description")

    return {
        "amount": amount,
        "description": _capitalize_first_letter(description) if description else "",
        "type": transaction_type,
        "category": category,
        "date": resolved_date,
        "date_explicit": date_explicit,
        "missing": missing,
        "raw_text": text,
    }


async def check_category_owned(
    category_id: int | None, profile: Profile, conn: asyncpg.Connection
) -> None:
    if category_id is None:
        return
    cat = await conn.fetchrow(
        "SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = TRUE)",
        category_id,
        profile.user_id,
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


async def check_related_ids_owned(
    *,
    account_id: int | None,
    bill_id: int | None = None,
    goal_id: int | None = None,
    merchant_id: int | None = None,
    profile: Profile,
    conn: asyncpg.Connection,
) -> None:
    """A caller can freely pass any account/bill/goal/merchant id on a transaction
    write — without this, nothing stops one profile's transaction from pointing at
    another profile's account (isolation on writes; matters once family shares the
    app). `None` (not set / clearing an optional FK) is always allowed."""
    if account_id is not None and await get_account(account_id, profile.id, conn) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if bill_id is not None and await get_bill(bill_id, profile.id, conn) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    if goal_id is not None and await get_goal(goal_id, profile.id, conn) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    if merchant_id is not None and await get_merchant(merchant_id, profile.id, conn) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")
