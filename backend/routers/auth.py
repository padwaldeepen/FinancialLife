from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from core.config import settings
from core.logging import get_logger
from core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from database.models import COUNTRY_CURRENCY, Profile, User
from database.session import get_db
from services.account_service import create_default_account

log = get_logger(__name__)

router = APIRouter()
security = HTTPBearer()

REFRESH_COOKIE_KEY = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    country: str = Field(pattern="^(US|IN|CA)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileResponse(BaseModel):
    id: int
    country: str
    currency: str

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    country: str = Field(pattern="^(US|IN|CA)$")


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    is_admin: bool
    profiles: list[ProfileResponse]


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str | None
    is_admin: bool
    is_active: bool
    ai_cloud_enabled: bool = False

    class Config:
        from_attributes = True


class AISettingsUpdate(BaseModel):
    ai_cloud_enabled: bool


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


def _row_to_user(row: asyncpg.Record) -> User:
    return User(**dict(row))


def _row_to_profile(row: asyncpg.Record) -> Profile:
    return Profile(**dict(row))


def _set_refresh_cookie(response: Response, token: str, request: Request | None = None) -> None:
    secure = request.url.scheme == "https" if request else True
    response.set_cookie(
        key=REFRESH_COOKIE_KEY,
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_KEY, path=REFRESH_COOKIE_PATH)


async def _issue_tokens(
    user: User,
    response: Response,
    conn: asyncpg.Connection,
    request: Request | None = None,
    profiles: list[Profile] | None = None,
) -> dict:
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    _set_refresh_cookie(response, refresh_token, request)

    if profiles is None:
        rows = await conn.fetch("SELECT * FROM profiles WHERE user_id = $1", user.id)
        profiles = [_row_to_profile(r) for r in rows]

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "profiles": [ProfileResponse.model_validate(p) for p in profiles],
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn: asyncpg.Connection = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", int(user_id_str))
    if row is None or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _row_to_user(row)


async def get_current_profile(
    x_profile_id: str | None = Header(default=None, alias="X-Profile-Id"),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> Profile:
    """Every financial route depends on this, never on get_current_user directly.
    Validates the requested profile belongs to the authenticated user — this is the
    country-profile isolation boundary (architecture-and-goals.md), one level below
    the user isolation get_current_user already provides."""
    if x_profile_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Profile-Id header is required",
        )
    try:
        profile_id = int(x_profile_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Profile-Id"
        ) from None

    row = await conn.fetchrow(
        "SELECT * FROM profiles WHERE id = $1 AND user_id = $2",
        profile_id,
        current_user.id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return _row_to_profile(row)


@router.post("/register", response_model=Token)
async def register(
    user_data: UserCreate,
    request: Request,
    response: Response,
    conn: asyncpg.Connection = Depends(get_db),
):
    log.info("Registration attempt — email=%s", user_data.email)

    existing = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        user_data.email,
        user_data.username,
    )
    if existing is not None:
        log.warning("Registration failed — email already exists: %s", user_data.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )

    # First registered user in the whole app becomes admin. Deliberate personal-app
    # bootstrap rule, not a general invariant — see architecture-and-goals.md.
    user_count = await conn.fetchval("SELECT COUNT(*) FROM users")
    is_first_user = user_count == 0

    hashed_password = get_password_hash(user_data.password)

    async with conn.transaction():
        user_row = await conn.fetchrow(
            """INSERT INTO users (email, username, hashed_password, full_name, is_admin)
               VALUES ($1, $2, $3, $4, $5) RETURNING *""",
            user_data.email,
            user_data.username,
            hashed_password,
            user_data.full_name,
            is_first_user,
        )
        db_user = _row_to_user(user_row)

        profile_row = await conn.fetchrow(
            """INSERT INTO profiles (user_id, country, currency)
               VALUES ($1, $2, $3) RETURNING *""",
            db_user.id,
            user_data.country,
            COUNTRY_CURRENCY[user_data.country],
        )
        profile = _row_to_profile(profile_row)

        await create_default_account(profile, conn)

    log.info(
        "Registration successful — user_id=%d email=%s country=%s is_admin=%s",
        db_user.id,
        db_user.email,
        user_data.country,
        is_first_user,
    )

    return Token(**await _issue_tokens(db_user, response, conn, request, profiles=[profile]))


@router.post("/login", response_model=Token)
async def login(
    user_credentials: UserLogin,
    request: Request,
    response: Response,
    conn: asyncpg.Connection = Depends(get_db),
):
    log.info("Login attempt — email=%s", user_credentials.email)

    row = await conn.fetchrow("SELECT * FROM users WHERE email = $1", user_credentials.email)
    if not row:
        log.warning("Login failed — user not found: %s", user_credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = _row_to_user(row)

    if not verify_password(user_credentials.password, user.hashed_password):
        log.warning("Login failed — wrong password for: %s", user_credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log.warning("Login failed — inactive user: %s", user_credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    log.info("Login successful — user_id=%d email=%s", user.id, user.email)

    return Token(**await _issue_tokens(user, response, conn, request))


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    conn: asyncpg.Connection = Depends(get_db),
    cookie: str | None = Cookie(None, alias=REFRESH_COOKIE_KEY),
):
    payload = verify_token(cookie)
    if payload is None or payload.get("type") != "refresh":
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
        )

    row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", int(user_id_str))
    if not row or not row["is_active"]:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return Token(**await _issue_tokens(_row_to_user(row), response, conn, request))


@router.post("/logout")
async def logout(response: Response):
    _clear_refresh_cookie(response)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    log.debug("User info fetched — user_id=%d email=%s", current_user.id, current_user.email)
    return current_user


@router.put("/me/ai-settings", response_model=UserResponse)
async def update_ai_settings(
    payload: AISettingsUpdate,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Per-user cloud-AI opt-in. Off (default) = this user's data never goes to Gemini."""
    row = await conn.fetchrow(
        "UPDATE users SET ai_cloud_enabled = $1 WHERE id = $2 RETURNING *",
        payload.ai_cloud_enabled,
        current_user.id,
    )
    log.info(
        "AI cloud toggle set — user_id=%d enabled=%s", current_user.id, payload.ai_cloud_enabled
    )
    return _row_to_user(row)


@router.put("/me/password")
async def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow("SELECT hashed_password FROM users WHERE id = $1", current_user.id)
    if not row or not verify_password(payload.current_password, row["hashed_password"]):
        log.warning("Password change failed — wrong current password: user_id=%d", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    await conn.execute(
        "UPDATE users SET hashed_password = $1 WHERE id = $2",
        get_password_hash(payload.new_password),
        current_user.id,
    )
    log.info("Password changed — user_id=%d", current_user.id)
    return {"detail": "Password updated"}


@router.get("/profiles", response_model=list[ProfileResponse])
async def list_profiles(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch("SELECT * FROM profiles WHERE user_id = $1", current_user.id)
    return [_row_to_profile(r) for r in rows]


@router.post("/profiles", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def add_profile(
    payload: ProfileCreate,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Add a second/third country profile — max one per country per user
    (enforced by the DB unique constraint, checked here for a clean error)."""
    existing = await conn.fetchrow(
        "SELECT id FROM profiles WHERE user_id = $1 AND country = $2",
        current_user.id,
        payload.country,
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a {payload.country} profile",
        )

    async with conn.transaction():
        row = await conn.fetchrow(
            """INSERT INTO profiles (user_id, country, currency)
               VALUES ($1, $2, $3) RETURNING *""",
            current_user.id,
            payload.country,
            COUNTRY_CURRENCY[payload.country],
        )
        profile = _row_to_profile(row)
        await create_default_account(profile, conn)

    log.info(
        "Profile added — user_id=%d country=%s profile_id=%d",
        current_user.id,
        payload.country,
        profile.id,
    )
    return profile
