from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Account, Category, Merchant, User
from database.session import get_db
from routers.auth import get_current_user
from services import bill_service

router = APIRouter()


class BillCreate(BaseModel):
    name: str
    amount: float
    frequency: str
    due_day: int
    account_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    amount_estimated: float | None = None
    is_variable: bool = False
    notes: str | None = None


class BillUpdate(BaseModel):
    name: str | None = None
    amount: float | None = None
    frequency: str | None = None
    due_day: int | None = None
    account_id: int | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    amount_estimated: float | None = None
    is_variable: bool | None = None
    is_active: bool | None = None
    notes: str | None = None


class BillResponse(BaseModel):
    id: int
    name: str
    amount: float
    amount_estimated: float | None
    frequency: str
    due_day: int
    category_id: int | None
    category_name: str | None
    merchant_id: int | None
    merchant_name: str | None
    account_id: int
    account_name: str | None
    is_active: bool
    is_variable: bool
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UpcomingBillResponse(BaseModel):
    id: int
    name: str
    amount: float
    amount_estimated: float | None
    frequency: str
    due_day: int
    next_due: str
    days_until: int
    category_name: str | None
    account_name: str | None
    merchant_name: str | None
    is_variable: bool


def _to_response(bill) -> BillResponse:
    return BillResponse(
        id=bill.id,
        name=bill.name,
        amount=bill.amount,
        amount_estimated=bill.amount_estimated,
        frequency=bill.frequency,
        due_day=bill.due_day,
        category_id=bill.category_id,
        category_name=bill.category.name if bill.category else None,
        merchant_id=bill.merchant_id,
        merchant_name=bill.merchant.name if bill.merchant else None,
        account_id=bill.account_id,
        account_name=bill.account.name if bill.account else None,
        is_active=bill.is_active,
        is_variable=bill.is_variable,
        notes=bill.notes,
        created_at=bill.created_at,
    )


@router.get("/", response_model=list[BillResponse])
async def list_bills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bills = await bill_service.get_bills(current_user.id, db)
    return [_to_response(b) for b in bills]


@router.get("/upcoming", response_model=list[UpcomingBillResponse])
async def upcoming_bills(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bills = await bill_service.get_bills(current_user.id, db)
    return bill_service.compute_upcoming(bills, days)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bill = await bill_service.get_bill(bill_id, current_user.id, db)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return _to_response(bill)


@router.post("/", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if bill_data.category_id is not None:
        result = await db.execute(
            select(Category).where(
                Category.id == bill_data.category_id,
                (Category.user_id == current_user.id) | (Category.is_system.is_(True)),
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Category not found")

    if bill_data.merchant_id is not None:
        result = await db.execute(
            select(Merchant).where(
                Merchant.id == bill_data.merchant_id,
                Merchant.user_id == current_user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Merchant not found")

    result = await db.execute(
        select(Account).where(
            Account.id == bill_data.account_id,
            Account.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")

    bill = await bill_service.create_bill(
        db,
        user_id=current_user.id,
        name=bill_data.name,
        amount=bill_data.amount,
        frequency=bill_data.frequency,
        due_day=bill_data.due_day,
        account_id=bill_data.account_id,
        category_id=bill_data.category_id,
        merchant_id=bill_data.merchant_id,
        amount_estimated=bill_data.amount_estimated,
        is_variable=bill_data.is_variable,
        notes=bill_data.notes,
    )
    await db.commit()
    return _to_response(bill)


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    bill_data: BillUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = bill_data.model_dump(exclude_unset=True)
    bill = await bill_service.update_bill(bill_id, current_user.id, update_data, db)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    await db.commit()
    return _to_response(bill)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await bill_service.delete_bill(bill_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    await db.commit()


class TransactionHistory(BaseModel):
    id: int
    amount: float
    description: str
    date: str
    category_name: str | None


class BillHistoryResponse(BaseModel):
    transactions: list[TransactionHistory]
    monthly_spending: list[dict]


@router.get("/{bill_id}/history", response_model=BillHistoryResponse)
async def bill_history(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await bill_service.get_bill_history(bill_id, current_user.id, db)
