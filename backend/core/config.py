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

    DATABASE_URL: str = "postgresql://user:password@localhost/financeflareai"

    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://financeflareai.vercel.app",
    ]
    ALLOWED_HOSTS: list[str] = [
        "localhost",
        "127.0.0.1",
        ".vercel.app",
    ]

    USE_AI: bool = False
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""


settings = Settings()
