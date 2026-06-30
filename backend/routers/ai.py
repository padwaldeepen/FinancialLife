from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Category, User
from database.session import get_db
from routers.auth import get_current_user
from services.ai.ai_service import AIService
from services.transaction_service import parse_transaction

router = APIRouter()
ai_service = AIService()


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
    merchant: str | None = None
    ai_provider: str | None = None


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transaction(
    request: CategorizeRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ai_result = await ai_service.parse(request.description)

    if ai_result is not None:
        category = ai_result.category or "Other"
        confidence = ai_result.confidence
        merchant = ai_result.merchant
        ai_provider = "gemini"
        extracted_amount = ai_result.amount if ai_result.amount is not None else request.amount
        transaction_type = ai_result.transaction_type
    else:
        result = parse_transaction(request.description)
        category = result.get("category") or "Other"
        confidence = 0.85
        merchant = result.get("merchant")
        ai_provider = None
        extracted_amount = (
            result.get("amount") if result.get("amount") is not None else request.amount
        )
        transaction_type = result.get("type", "expense")

    system_cats = await db.execute(select(Category).where(Category.is_system.is_(True)))
    valid_names = {cat.name for cat in system_cats.scalars().all()}

    if category not in valid_names:
        category = "Other"

    return CategorizeResponse(
        suggested_category=category,
        confidence=confidence,
        extracted_amount=extracted_amount,
        transaction_type=transaction_type,
        merchant=merchant,
        ai_provider=ai_provider,
    )


@router.get("/categories")
async def get_available_categories(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
