from core.config import settings
from core.logging import get_logger

from .base import ParseResult
from .gemini import GeminiService

log = get_logger(__name__)


class AIService:
    def __init__(self):
        self._gemini = GeminiService()
        self._use_ai = settings.USE_AI

    async def parse(self, text: str) -> ParseResult | None:
        if not self._use_ai:
            return None

        if settings.GEMINI_API_KEY:
            result = await self._gemini.parse(text)
            if result is not None:
                log.info("Gemini parsed: %s", text[:50])
                return result

        log.info("AI unavailable or failed, returning None for fallback")
        return None
