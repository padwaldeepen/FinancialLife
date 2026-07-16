from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.middleware import invalidate_response_cache
from database.models import User
from database.session import get_db
from routers.auth import get_current_user
from services import account_service

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    type: Literal["checking", "savings", "credit", "cash", "investment"]
    currency: str = "USD"


class AccountUpdate(BaseModel):
    name: str | None = None
    type: Literal["checking", "savings", "credit", "cash", "investment"] | None = None
    currency: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class AccountResponse(BaseModel):
    id: int
    name: str
    type: str
    currency: str
    balance: float
    is_active: bool
    sort_order: int
    created_at: str | None = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = await account_service.get_accounts(current_user.id, db)
    balances = await account_service.get_account_balances(current_user.id, db)
    results = []
    for account in accounts:
        balance = balances.get(account.id, 0.0)
        results.append(
            AccountResponse(
                id=account.id,
                name=account.name,
                type=account.type,
                currency=account.currency,
                balance=balance,
                is_active=account.is_active,
                sort_order=account.sort_order,
                created_at=account.created_at.isoformat() if account.created_at else None,
            )
        )
    return results


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await account_service.get_account(account_id, current_user.id, db)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    balance = await account_service.get_account_balance(account.id, db)
    return AccountResponse(
        id=account.id,
        name=account.name,
        type=account.type,
        currency=account.currency,
        balance=balance,
        is_active=account.is_active,
        sort_order=account.sort_order,
        created_at=account.created_at.isoformat() if account.created_at else None,
    )


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await account_service.create_account(
        current_user.id,
        account_data.name,
        account_data.type,
        account_data.currency,
        db,
    )
    await db.commit()
    await db.refresh(account)
    invalidate_response_cache("/api/accounts/")
    balance = await account_service.get_account_balance(account.id, db)
    return AccountResponse(
        id=account.id,
        name=account.name,
        type=account.type,
        currency=account.currency,
        balance=balance,
        is_active=account.is_active,
        sort_order=account.sort_order,
        created_at=account.created_at.isoformat() if account.created_at else None,
    )


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = account_data.model_dump(exclude_unset=True)
    account = await account_service.update_account(account_id, current_user.id, update_data, db)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    await db.commit()
    await db.refresh(account)
    invalidate_response_cache("/api/accounts/")
    balance = await account_service.get_account_balance(account.id, db)
    return AccountResponse(
        id=account.id,
        name=account.name,
        type=account.type,
        currency=account.currency,
        balance=balance,
        is_active=account.is_active,
        sort_order=account.sort_order,
        created_at=account.created_at.isoformat() if account.created_at else None,
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await account_service.delete_account(account_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    await db.commit()
