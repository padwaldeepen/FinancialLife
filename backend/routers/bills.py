from datetime import datetime
from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from core.money import Money
from database.models import MAX_MONEY_AMOUNT, Profile
from database.session import get_db
from routers.auth import get_current_profile
from services import bill_service
from services.transaction_service import check_category_owned, check_related_ids_owned

router = APIRouter()


# weekly/biweekly store due_day as a weekday index (0=Monday..6=Sunday, matching
# _next_due_date's use of date.weekday()); monthly/quarterly/yearly store it as a
# day-of-month (1-31). Same column, different valid range depending on frequency.
_WEEKDAY_FREQUENCIES = {"weekly", "biweekly"}


def _validate_due_day(frequency: str | None, due_day: int | None) -> None:
    if frequency is None or due_day is None:
        return
    if frequency in _WEEKDAY_FREQUENCIES:
        if not 0 <= due_day <= 6:
            raise ValueError("due_day must be 0-6 (Monday-Sunday) for weekly/biweekly bills")
    elif not 1 <= due_day <= 31:
        raise ValueError("due_day must be 1-31 for monthly/quarterly/yearly bills")


class BillCreate(BaseModel):
    name: str
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    frequency: Literal["weekly", "biweekly", "monthly", "quarterly", "yearly"]
    due_day: int = Field(ge=0, le=31)
    account_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    amount_estimated: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    is_variable: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def _check_due_day(self) -> "BillCreate":
        _validate_due_day(self.frequency, self.due_day)
        return self


class BillUpdate(BaseModel):
    name: str | None = None
    amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    frequency: Literal["weekly", "biweekly", "monthly", "quarterly", "yearly"] | None = None
    due_day: int | None = Field(default=None, ge=0, le=31)
    account_id: int | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    amount_estimated: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY_AMOUNT)
    is_variable: bool | None = None
    is_active: bool | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_due_day(self) -> "BillUpdate":
        _validate_due_day(self.frequency, self.due_day)
        return self


class BillResponse(BaseModel):
    id: int
    name: str
    amount: Money
    amount_estimated: Money | None
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
    amount: Money
    amount_estimated: Money | None
    frequency: str
    due_day: int
    next_due: str
    days_until: int
    category_name: str | None
    account_name: str | None
    merchant_name: str | None
    is_variable: bool
    has_paid: bool = False


def _to_response(bill: dict) -> BillResponse:
    return BillResponse(
        id=bill["id"],
        name=bill["name"],
        amount=float(bill["amount"]),
        amount_estimated=float(bill["amount_estimated"]) if bill["amount_estimated"] else None,
        frequency=bill["frequency"],
        due_day=bill["due_day"],
        category_id=bill["category_id"],
        category_name=bill["category_name"],
        merchant_id=bill["merchant_id"],
        merchant_name=bill["merchant_name"],
        account_id=bill["account_id"],
        account_name=bill["account_name"],
        is_active=bill["is_active"],
        is_variable=bill["is_variable"],
        notes=bill["notes"],
        created_at=bill["created_at"],
    )


@router.get("/", response_model=list[BillResponse])
async def list_bills(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    bills = await bill_service.get_bills(profile.id, conn)
    return [_to_response(b) for b in bills]


@router.get("/upcoming", response_model=list[UpcomingBillResponse])
async def upcoming_bills(
    days: int = 7,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    bills = await bill_service.get_bills(profile.id, conn)
    return await bill_service.compute_upcoming_async(bills, days, conn)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    bill = await bill_service.get_bill(bill_id, profile.id, conn)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return _to_response(bill)


@router.post("/", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    # R4(a): the same ownership gate every other write path uses, instead of three
    # hand-rolled queries that could drift from it.
    await check_category_owned(bill_data.category_id, profile, conn)
    await check_related_ids_owned(
        account_id=bill_data.account_id,
        merchant_id=bill_data.merchant_id,
        profile=profile,
        conn=conn,
    )

    bill = await bill_service.create_bill(
        conn,
        profile_id=profile.id,
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
    return _to_response(bill)


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    bill_data: BillUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = bill_data.model_dump(exclude_unset=True)
    bill = await bill_service.update_bill(bill_id, profile.id, update_data, conn)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return _to_response(bill)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(
    bill_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    deleted = await bill_service.delete_bill(bill_id, profile.id, conn)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")


class TransactionHistory(BaseModel):
    id: int
    amount: Money
    description: str
    date: str
    category_name: str | None


class BillHistoryResponse(BaseModel):
    transactions: list[TransactionHistory]
    monthly_spending: list[dict]


@router.get("/{bill_id}/history", response_model=BillHistoryResponse)
async def bill_history(
    bill_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    return await bill_service.get_bill_history(bill_id, profile.id, conn)


class LinkSuggestion(BaseModel):
    bill_id: int
    bill_name: str
    bill_amount: Money
    confidence: str


class SuggestLinkRequest(BaseModel):
    description: str
    amount: Money
    date: datetime
    merchant_id: int | None = None


@router.post("/suggest-link", response_model=LinkSuggestion | None)
async def suggest_link(
    request: SuggestLinkRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    bill = await bill_service.suggest_bill_match(
        profile.id,
        request.description,
        request.amount,
        request.date,
        request.merchant_id,
        conn,
    )
    if not bill:
        return None
    return LinkSuggestion(
        bill_id=bill["id"],
        bill_name=bill["name"],
        bill_amount=float(bill["amount"]),
        confidence="high",
    )


@router.post("/{bill_id}/link/{transaction_id}")
async def link_transaction(
    bill_id: int,
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    tx = await conn.fetchrow(
        "SELECT id FROM transactions WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bill = await conn.fetchrow(
        "SELECT id FROM bills WHERE id = $1 AND profile_id = $2", bill_id, profile.id
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    await conn.execute(
        "UPDATE transactions SET bill_id = $1 WHERE id = $2", bill_id, transaction_id
    )
    return {"message": "Transaction linked to bill"}


@router.delete("/{bill_id}/link/{transaction_id}")
async def unlink_transaction(
    bill_id: int,
    transaction_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    bill = await conn.fetchrow(
        "SELECT id FROM bills WHERE id = $1 AND profile_id = $2", bill_id, profile.id
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    await conn.execute(
        "UPDATE transactions SET bill_id = NULL WHERE id = $1 AND profile_id = $2",
        transaction_id,
        profile.id,
    )
    return {"message": "Transaction unlinked from bill"}
