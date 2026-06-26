from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "FinanceFlareAI"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://user:password@localhost/financeflareai"

    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
