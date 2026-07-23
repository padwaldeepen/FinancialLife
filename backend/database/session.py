import json
from collections.abc import AsyncGenerator

import asyncpg

from core.config import settings

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    # asyncpg has no built-in jsonb codec — without this, every jsonb column (e.g.
    # merchants.aliases) round-trips as raw JSON text instead of a decoded
    # list/dict, forcing manual json.loads/json.dumps at every call site. Registered
    # once here for every connection in the pool instead.
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=20,
        init=_init_connection,
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized — call init_pool() at startup")
    return _pool


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency: acquires one connection from the pool for the request.
    Never acquire connections manually elsewhere — always through this."""
    async with get_pool().acquire() as conn:
        yield conn
