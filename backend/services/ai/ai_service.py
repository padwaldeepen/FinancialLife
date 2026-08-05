from core.config import settings
from core.logging import get_logger

from .gemini import GeminiService, ParseResult

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

    async def extract_receipt(
        self, image_bytes: bytes, mime_type: str, cloud_enabled: bool = False
    ) -> dict | None:
        if not cloud_enabled or not settings.GEMINI_API_KEY:
            return None

        result = await self._gemini.extract_receipt(image_bytes, mime_type)
        if result is not None:
            log.info("Gemini extracted a receipt (%d bytes)", len(image_bytes))
            return result

        log.info("Gemini unavailable or failed, falling back to tier C (Tesseract)")
        return None

    async def extract_statement(
        self, file_bytes: bytes, mime_type: str, cloud_enabled: bool = False
    ) -> dict | None:
        if not cloud_enabled or not settings.GEMINI_API_KEY:
            return None

        result = await self._gemini.extract_statement(file_bytes, mime_type)
        if result is not None:
            log.info("Gemini extracted a statement (%d bytes)", len(file_bytes))
            return result

        log.info("Gemini unavailable or failed, falling back to tier C (pdfplumber)")
        return None
