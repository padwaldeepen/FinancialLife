import re

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


def _extract_amount(text: str) -> float | None:
    patterns = [
        r"(?:spent|paid|sent|used|gave|cost|spend|spending)\s*\$?\s*([\d]+(?:\.\d{1,2})?)",
        r"\$?\s*([\d]+(?:\.\d{1,2})?)\s*(?:dollars|bucks|rs|rupees)?\s*(?:on|for|at|in|to)",
        r"(?:^|[^a-z])\$?\s*([\d]+(?:\.\d{1,2})?)\s*(?:dollars|bucks|rs|rupees)?(?:$|[^a-z])",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(match.group(1))

    return None


def _extract_description(text: str, amount: float | None) -> str:
    if amount is None:
        return text.strip()

    # Remove the amount part
    cleaned = re.sub(
        r"(?:spent|paid|sent|used|gave|cost|spend|spending)?\s*\$?\s*"
        + re.escape(f"{amount:.2f}" if amount != int(amount) else f"{int(amount)}")
        + r"\s*(?:dollars|bucks|rs|rupees)?\s*(?:on|for|at|in|to|:)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()

    # Remove leading noise words
    noise = r"^(?:spent|paid|sent|used|gave|bought|got|received|earned)\s+"
    cleaned = re.sub(noise, "", cleaned, flags=re.IGNORECASE).strip()

    # Remove trailing prepositions
    cleaned = re.sub(r"\s+(?:on|for|at|in|to|with)$", "", cleaned, flags=re.IGNORECASE).strip()

    return cleaned if cleaned else text.strip()


def _determine_type(description: str) -> str:
    income_keywords = ["salary", "received", "earned", "income", "deposit", "refund", "freelance"]
    for kw in income_keywords:
        if kw in description.lower():
            return "income"
    return "expense"


def _categorize(description: str, transaction_type: str) -> str | None:
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


def parse_transaction(text: str) -> dict:
    amount = _extract_amount(text)
    description = _extract_description(text, amount)
    transaction_type = _determine_type(description)
    category = _categorize(description, transaction_type)

    return {
        "amount": amount,
        "description": description.capitalize() if description else "",
        "type": transaction_type,
        "category": category,
        "raw_text": text,
    }
