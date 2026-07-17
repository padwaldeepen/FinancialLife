from core.config import settings
from core.logging import get_logger

from .base import ParseResult
from .gemini import GeminiService

log = get_logger(__name__)


class AIService:
    """The single gateway for cloud AI. Every call requires the requesting user's
    ai_cloud_enabled flag — toggle off (the default) means zero outbound AI calls."""

    def __init__(self):
        self._gemini = GeminiService()

    async def parse(self, text: str, cloud_enabled: bool = False) -> ParseResult | None:
        if not cloud_enabled or not settings.GEMINI_API_KEY:
            return None

        result = await self._gemini.parse(text)
        if result is not None:
            log.info("Gemini parsed: %s", text[:50])
            return result

        log.info("Gemini unavailable or failed, returning None for rule-based fallback")
        return None
