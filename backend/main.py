from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from core.config import settings
from core.logging import get_logger, log_startup
from core.middleware import RateLimitMiddleware, ResponseCacheMiddleware, SecurityHeadersMiddleware
from database.session import AsyncSessionLocal
from routers import (
    accounts,
    ai,
    auth,
    bills,
    budgets,
    categories,
    chat,
    export,
    goals,
    merchants,
    reports,
    transactions,
)

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log_startup()
    log.info("Database tables managed by Alembic migrations")
    try:
        async with AsyncSessionLocal() as db:
            from services.category_service import seed_system_categories

            await seed_system_categories(db)
            log.info("System categories seeded")
    except Exception as e:
        log.warning("Could not seed system categories: %s", e)
    yield


app = FastAPI(
    title="My Financial Life API",
    description="Personal finance management API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(ResponseCacheMiddleware)

app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(bills.router, prefix="/api/bills", tags=["Bills"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Services"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(goals.router, prefix="/api/goals", tags=["Goals"])
app.include_router(merchants.router)
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/")
async def root():
    return {"message": "My Financial Life API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
