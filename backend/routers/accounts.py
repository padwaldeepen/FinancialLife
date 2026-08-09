from decimal import Decimal
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.money import Money
from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from services import account_service

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    type: Literal["checking", "savings", "credit", "cash", "investment"]


class AccountUpdate(BaseModel):
    name: str | None = None
    type: Literal["checking", "savings", "credit", "cash", "investment"] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class AccountResponse(BaseModel):
    id: int
    name: str
    type: str
    # R6: Decimal internally (Postgres sums money exactly as NUMERIC), serialised as a
    # JSON number at the boundary — see core/money.py.
    balance: Money
    is_active: bool
    sort_order: int
    created_at: str | None = None

    class Config:
        from_attributes = True


def _to_response(account, balance: Decimal) -> AccountResponse:
    return AccountResponse(
        id=account.id,
        name=account.name,
        type=account.type,
        balance=balance,
        is_active=account.is_active,
        sort_order=account.sort_order,
        created_at=account.created_at.isoformat() if account.created_at else None,
    )


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    accounts = await account_service.get_accounts(profile.id, conn)
    balances = await account_service.get_account_balances(profile.id, conn)
    return [_to_response(a, balances.get(a.id, Decimal("0"))) for a in accounts]


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    account = await account_service.get_account(account_id, profile.id, conn)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    balance = await account_service.get_account_balance(account.id, conn)
    return _to_response(account, balance)


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    account = await account_service.create_account(
        profile.id, account_data.name, account_data.type, conn
    )
    balance = await account_service.get_account_balance(account.id, conn)
    return _to_response(account, balance)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_data: AccountUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = account_data.model_dump(exclude_unset=True)
    account = await account_service.update_account(account_id, profile.id, update_data, conn)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    balance = await account_service.get_account_balance(account.id, conn)
    return _to_response(account, balance)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    deleted = await account_service.delete_account(account_id, profile.id, conn)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
