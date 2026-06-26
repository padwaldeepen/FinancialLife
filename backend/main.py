from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from core.config import settings
from core.logging import get_logger, log_startup
from database.models import Base
from database.session import engine
from routers import ai, auth, budgets, transactions

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log_startup()
    log.info("Creating database tables…")
    Base.metadata.create_all(bind=engine)
    log.info("Ready")
    yield


app = FastAPI(
    title="FinanceFlareAI API",
    description="AI-powered personal budget tracker API",
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

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Services"])


@app.get("/")
async def root():
    return {"message": "FinanceFlareAI API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
