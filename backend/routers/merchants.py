import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from services.merchant_service import (
    backfill_merchants,
    delete_merchant,
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


class MerchantUpdate(BaseModel):
    name: str | None = None
    is_hidden: bool | None = None


class MerchantMerge(BaseModel):
    target_id: int
    source_ids: list[int]


def _to_response(row: dict) -> MerchantResponse:
    # No jsonb codec is registered on this pool, so `aliases` comes back as raw JSON
    # text rather than a decoded list whenever it's non-null (merge_merchants writes it
    # with an explicit json.dumps for the same reason).
    aliases = row["aliases"]
    if isinstance(aliases, str):
        aliases = json.loads(aliases)
    return MerchantResponse(
        id=row["id"],
        name=row["name"],
        normalized_name=row["normalized_name"],
        aliases=aliases,
        is_hidden=row["is_hidden"],
        transaction_count=row["transaction_count"],
        total_spent=float(row["total_spent"]),
    )


@router.get("/")
async def list_merchants(
    include_hidden: bool = False,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    merchants = await get_merchants(profile.id, conn, include_hidden=include_hidden)
    return [_to_response(m) for m in merchants]


@router.get("/{merchant_id}")
async def merchant_detail(
    merchant_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    result = await get_merchant_summary(merchant_id, profile.id, conn)
    if not result:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return result


@router.put("/{merchant_id}")
async def update_merchant_endpoint(
    merchant_id: int,
    data: MerchantUpdate,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    merchant = await update_merchant(merchant_id, profile.id, update_data, conn)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _to_response(merchant)


@router.post("/merge")
async def merge_merchants_endpoint(
    data: MerchantMerge,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    merchant = await merge_merchants(data.target_id, data.source_ids, profile.id, conn)
    if not merchant:
        raise HTTPException(status_code=404, detail="Target merchant not found")
    return _to_response(merchant)


@router.get("/similar/")
async def similar_merchants(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    return await find_similar_merchants(profile.id, conn)


@router.delete("/{merchant_id}", status_code=204)
async def delete_merchant_endpoint(
    merchant_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    deleted = await delete_merchant(merchant_id, profile.id, conn)
    if not deleted:
        raise HTTPException(status_code=404, detail="Merchant not found")


@router.post("/backfill")
async def backfill_endpoint(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    count = await backfill_merchants(profile.id, conn)
    return {"backfilled": count}
