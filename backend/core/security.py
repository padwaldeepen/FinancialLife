from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _create_jwt(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    # "type" distinguishes this from a refresh token so one can't authenticate as the
    # other if it ever leaked into the wrong place (e.g. a refresh token sent as a
    # Bearer header) — both used to encode only {"sub", "exp"}, so a valid signature
    # alone was enough to pass as either.
    return _create_jwt(
        {**data, "type": "access"},
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(data: dict):
    return _create_jwt(
        {**data, "type": "refresh"}, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def verify_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None
