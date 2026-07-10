import logging
import sys

from core.config import settings


def setup_logging(*, name: str = "myfinanciallife") -> logging.Logger:
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    level = logging.DEBUG if settings.DEBUG else logging.INFO
    logger.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"myfinanciallife.{name}")


def log_startup() -> None:
    log = get_logger("startup")
    log.info("─" * 50)
    log.info("My Financial Life — %s", settings.VERSION)
    log.info("─" * 50)
    log.info("DEBUG ............ %s", settings.DEBUG)
    log.info("Database URL ..... %s", _mask_db_url(settings.DATABASE_URL))
    log.info("Allowed origins .. %s", settings.ALLOWED_ORIGINS)
    log.info("─" * 50)


def _mask_db_url(url: str) -> str:
    """Mask credentials in a database URL for safe logging."""
    if "@" in url:
        scheme_rest, host = url.rsplit("@", 1)
        scheme = scheme_rest.split("://")[0] if "://" in scheme_rest else scheme_rest
        return f"{scheme}://****:****@{host}"
    return url


setup_logging()
