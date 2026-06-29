from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from routers.auth import get_current_user
from services.merchant_service import (
    backfill_merchants,
    find_similar_merchants,
    get_merchant_summary,
    get_merchants,
    merge_merchants,
    update_merchant,
)

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


class MerchantResponse(BaseModel):
    id: int
    name: str
    normalized_name: str
    aliases: list[str] | None
    is_hidden: bool
    transaction_count: int
    total_spent: float

    model_config = {"from_attributes": True}


class MerchantDetailResponse(BaseModel):
    id: int
    name: str
    is_hidden: bool
    total_spent: float
    total_income: float
    transaction_count: int
    first_transaction_date: str | None
    last_transaction_date: str | None

    model_config = {"from_attributes": True}


class MerchantUpdate(BaseModel):
    name: str | None = None
    is_hidden: bool | None = None


class MerchantMerge(BaseModel):
    target_id: int
    source_ids: list[int]


@router.get("")
async def list_merchants(
    include_hidden: bool = False,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merchants = await get_merchants(user["id"], db, include_hidden=include_hidden)
    return [
        MerchantResponse(
            id=m.id,
            name=m.name,
            normalized_name=m.normalized_name,
            aliases=m.aliases,
            is_hidden=m.is_hidden,
            transaction_count=len(m.transactions),
            total_spent=sum(t.amount for t in m.transactions if t.transaction_type == "expense"),
        )
        for m in merchants
    ]


@router.get("/{merchant_id}")
async def merchant_detail(
    merchant_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await get_merchant_summary(merchant_id, user["id"], db)
    if not result:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return result


@router.put("/{merchant_id}")
async def update_merchant_endpoint(
    merchant_id: int,
    data: MerchantUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    merchant = await update_merchant(merchant_id, user["id"], update_data, db)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return MerchantResponse(
        id=merchant.id,
        name=merchant.name,
        normalized_name=merchant.normalized_name,
        aliases=merchant.aliases,
        is_hidden=merchant.is_hidden,
        transaction_count=len(merchant.transactions),
        total_spent=sum(t.amount for t in merchant.transactions if t.transaction_type == "expense"),
    )


@router.post("/merge")
async def merge_merchants_endpoint(
    data: MerchantMerge,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merchant = await merge_merchants(data.target_id, data.source_ids, user["id"], db)
    if not merchant:
        raise HTTPException(status_code=404, detail="Target merchant not found")
    return MerchantResponse(
        id=merchant.id,
        name=merchant.name,
        normalized_name=merchant.normalized_name,
        aliases=merchant.aliases,
        is_hidden=merchant.is_hidden,
        transaction_count=len(merchant.transactions),
        total_spent=sum(t.amount for t in merchant.transactions if t.transaction_type == "expense"),
    )


@router.get("/similar/")
async def similar_merchants(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await find_similar_merchants(user["id"], db)


@router.post("/backfill")
async def backfill_endpoint(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await backfill_merchants(user["id"], db)
    return {"backfilled": count}
