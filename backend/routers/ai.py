from fastapi import APIRouter
from pydantic import BaseModel

from services.transaction_service import parse_transaction

router = APIRouter()

EXPENSE_CATEGORIES = [
    "Food & Dining",
    "Transportation",
    "Shopping",
    "Entertainment",
    "Healthcare",
    "Utilities",
    "Housing",
    "Education",
    "Travel",
    "Insurance",
    "Taxes",
    "Personal Care",
    "Gifts",
    "Subscriptions",
    "Business",
    "Other",
]

INCOME_CATEGORIES = [
    "Salary",
    "Freelance",
    "Investment",
    "Business",
    "Gift",
    "Refund",
    "Other",
]


class CategorizeRequest(BaseModel):
    description: str
    amount: float | None = None
    date: str | None = None


class CategorizeResponse(BaseModel):
    suggested_category: str
    confidence: float
    extracted_amount: float | None = None
    extracted_date: str | None = None
    transaction_type: str


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transaction(request: CategorizeRequest):
    result = parse_transaction(request.description)

    category = result.get("category") or "Other"
    transaction_type = result.get("type", "expense")

    if category not in EXPENSE_CATEGORIES and category not in INCOME_CATEGORIES:
        category = "Other"

    return CategorizeResponse(
        suggested_category=category,
        confidence=0.85,
        extracted_amount=result.get("amount")
        if result.get("amount") is not None
        else request.amount,
        transaction_type=transaction_type,
    )


@router.get("/categories")
async def get_available_categories():
    return {
        "expense_categories": EXPENSE_CATEGORIES,
        "income_categories": INCOME_CATEGORIES,
    }
