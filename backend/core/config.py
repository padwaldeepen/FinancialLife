from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "My Financial Life"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = ""

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    ALLOWED_HOSTS: list[str] = [
        "localhost",
        "127.0.0.1",
    ]

    # Gemini is the ONLY cloud AI provider. Server-level key; each user opts in
    # via their own ai_cloud_enabled toggle (off by default — nothing leaves the
    # machine for users who haven't opted in).
    GEMINI_API_KEY: str = ""

    # S1: uploaded receipts/bills/statements. Relative to the backend working
    # directory — the docker-compose bind mount (./backend:/app) makes this persist
    # on the host without a separate named volume.
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024


settings = Settings()

if not settings.SECRET_KEY:
    raise ValueError(
        "SECRET_KEY is not set. Add SECRET_KEY to your .env file. "
        'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
    )
