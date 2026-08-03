"""Admin API — backlog.md A1. Desktop-only, `is_admin`-gated.

**Isolation rule (architecture-and-goals.md):** admin manages the *system*, never another
user's money. Every route here returns only user **metadata** (email/username/active flags),
global **system categories**, or **aggregate counts** — never a transaction, insight,
dashboard, or any financial row belonging to another user. There is deliberately no admin
route that reads another user's ledger.
"""

import subprocess
from pathlib import Path

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from core.logging import get_logger
from core.security import get_password_hash
from database.models import COUNTRY_CURRENCY, Profile, User
from database.session import get_db
from routers.auth import get_current_user
from services.account_service import create_default_account

log = get_logger(__name__)
router = APIRouter()

# Backups are deferred (plan.md "Later") — this script won't exist yet, so backup-now
# honestly reports "not configured". Relative to the backend working dir (/app).
_BACKUP_SCRIPT = Path("scripts/backup.ps1")


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Gate for every admin route. Non-admin (or an inactive account, already blocked by
    get_current_user) → 403."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


# --- Users (metadata only, never financial rows) -------------------------------------


class AdminUserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str | None
    is_admin: bool
    is_active: bool
    profile_count: int
    created_at: str


class AdminUserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    country: str = Field(pattern="^(US|IN|CA)$")


class UserActiveUpdate(BaseModel):
    is_active: bool


def _user_response(row: asyncpg.Record, profile_count: int) -> AdminUserResponse:
    return AdminUserResponse(
        id=row["id"],
        email=row["email"],
        username=row["username"],
        full_name=row["full_name"],
        is_admin=row["is_admin"],
        is_active=row["is_active"],
        profile_count=profile_count,
        created_at=row["created_at"].isoformat(),
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch(
        """SELECT u.id, u.email, u.username, u.full_name, u.is_admin, u.is_active,
                  u.created_at, COUNT(p.id) AS profile_count
           FROM users u LEFT JOIN profiles p ON p.user_id = u.id
           GROUP BY u.id ORDER BY u.id"""
    )
    return [_user_response(r, r["profile_count"]) for r in rows]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreate,
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Create a family user — a plain (non-admin) account with its first country profile
    and base accounts, exactly like self-registration but without issuing them a session.
    The new user logs in fresh with their own empty dashboard."""
    existing = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1 OR username = $2", payload.email, payload.username
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username already registered"
        )

    hashed = get_password_hash(payload.password)
    async with conn.transaction():
        user_row = await conn.fetchrow(
            """INSERT INTO users (email, username, hashed_password, full_name, is_admin)
               VALUES ($1, $2, $3, $4, FALSE) RETURNING *""",
            payload.email,
            payload.username,
            hashed,
            payload.full_name,
        )
        profile_row = await conn.fetchrow(
            """INSERT INTO profiles (user_id, country, currency)
               VALUES ($1, $2, $3) RETURNING *""",
            user_row["id"],
            payload.country,
            COUNTRY_CURRENCY[payload.country],
        )
        await create_default_account(Profile(**dict(profile_row)), conn)

    log.info("Admin created user_id=%d email=%s", user_row["id"], payload.email)
    return _user_response(user_row, profile_count=1)


@router.patch("/users/{user_id}/active", response_model=AdminUserResponse)
async def set_user_active(
    user_id: int,
    payload: UserActiveUpdate,
    admin: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't change your own active status",
        )
    target = await conn.fetchrow("SELECT is_admin FROM users WHERE id = $1", user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Never lock the system out of admin access by deactivating the last active admin.
    if not payload.is_active and target["is_admin"]:
        other_admins = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE is_admin AND is_active AND id <> $1", user_id
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can't deactivate the last active admin",
            )

    updated = await conn.fetchrow(
        "UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *", payload.is_active, user_id
    )
    profile_count = await conn.fetchval(
        "SELECT COUNT(*) FROM profiles WHERE user_id = $1", user_id
    )
    return _user_response(updated, profile_count)


# --- System categories (global, is_system) -------------------------------------------


class SystemCategoryResponse(BaseModel):
    id: int
    name: str
    color: str
    parent_id: int | None


class SystemCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#6B7280")
    parent_id: int | None = None


class SystemCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = None


@router.get("/system-categories", response_model=list[SystemCategoryResponse])
async def list_system_categories(
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch(
        """SELECT id, name, color, parent_id FROM categories
           WHERE is_system ORDER BY parent_id NULLS FIRST, name"""
    )
    return [SystemCategoryResponse(**dict(r)) for r in rows]


@router.post(
    "/system-categories",
    response_model=SystemCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_system_category(
    payload: SystemCategoryCreate,
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    if payload.parent_id is not None:
        parent = await conn.fetchrow(
            "SELECT id FROM categories WHERE id = $1 AND is_system", payload.parent_id
        )
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent must be an existing system category",
            )
    row = await conn.fetchrow(
        """INSERT INTO categories (name, color, is_system, user_id, parent_id)
           VALUES ($1, $2, TRUE, NULL, $3) RETURNING id, name, color, parent_id""",
        payload.name,
        payload.color,
        payload.parent_id,
    )
    return SystemCategoryResponse(**dict(row))


@router.patch("/system-categories/{category_id}", response_model=SystemCategoryResponse)
async def update_system_category(
    category_id: int,
    payload: SystemCategoryUpdate,
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    existing = await conn.fetchrow(
        "SELECT id FROM categories WHERE id = $1 AND is_system", category_id
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="System category not found"
        )
    row = await conn.fetchrow(
        """UPDATE categories
           SET name = COALESCE($1, name), color = COALESCE($2, color)
           WHERE id = $3 RETURNING id, name, color, parent_id""",
        payload.name,
        payload.color,
        category_id,
    )
    return SystemCategoryResponse(**dict(row))


@router.delete("/system-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_category(
    category_id: int,
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Transactions referencing it keep existing — `transactions.category_id` is
    ON DELETE SET NULL — and child system categories cascade to NULL parent."""
    existing = await conn.fetchrow(
        "SELECT id FROM categories WHERE id = $1 AND is_system", category_id
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="System category not found"
        )
    await conn.execute("DELETE FROM categories WHERE id = $1", category_id)


# --- System status + backup ----------------------------------------------------------


class AdminStatus(BaseModel):
    user_count: int
    active_user_count: int
    pending_documents: int
    total_transactions: int
    backup_configured: bool
    last_backup: str | None


@router.get("/status", response_model=AdminStatus)
async def admin_status(
    _: User = Depends(require_admin),
    conn: asyncpg.Connection = Depends(get_db),
):
    """System-health metrics only — aggregate counts, never any user's financial content."""
    users = await conn.fetchrow(
        "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM users"
    )
    pending = await conn.fetchval("SELECT COUNT(*) FROM documents WHERE status = 'pending'")
    total_tx = await conn.fetchval("SELECT COUNT(*) FROM transactions")
    return AdminStatus(
        user_count=users["total"],
        active_user_count=users["active"],
        pending_documents=pending,
        total_transactions=total_tx,
        backup_configured=_BACKUP_SCRIPT.exists(),
        last_backup=None,  # no backup metadata store yet (backups deferred, plan.md "Later")
    )


class BackupResult(BaseModel):
    status: str  # "started" | "not_configured" | "failed"
    message: str


@router.post("/backup", response_model=BackupResult)
async def trigger_backup(_: User = Depends(require_admin)):
    if not _BACKUP_SCRIPT.exists():
        return BackupResult(
            status="not_configured",
            message="No backup script (scripts/backup.ps1) is present. Backups are not set up yet.",
        )
    try:
        subprocess.Popen(["pwsh", "-File", str(_BACKUP_SCRIPT)])  # noqa: S603, S607
        return BackupResult(status="started", message="Backup started.")
    except Exception as e:  # pwsh unavailable, etc.
        log.warning("Backup trigger failed: %s", e)
        return BackupResult(status="failed", message=f"Could not start backup: {e}")
