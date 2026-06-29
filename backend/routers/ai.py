from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Category
from database.session import get_db
from services.transaction_service import parse_transaction

router = APIRouter()


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
async def categorize_transaction(
    request: CategorizeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = parse_transaction(request.description)

    category = result.get("category") or "Other"
    transaction_type = result.get("type", "expense")

    system_cats = await db.execute(select(Category).where(Category.is_system.is_(True)))
    valid_names = {cat.name for cat in system_cats.scalars().all()}

    if category not in valid_names:
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
async def get_available_categories(db: AsyncSession = Depends(get_db)):
    system_cats = await db.execute(
        select(Category).where(Category.is_system.is_(True)).order_by(Category.name)
    )
    categories = system_cats.scalars().all()

    expense_categories = [c.name for c in categories if c.name != "Income"]
    income_categories = ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"]

    return {
        "expense_categories": expense_categories,
        "income_categories": income_categories,
    }
