"""Advice card rephrasing — I6. Cloud AI (Gemini, gated by the user's T5 toggle) may
reword a template-worded advice message for warmth, but must never change the numbers
it's based on. Ollama isn't wired into this project yet (tracked under Phase S), so the
only "AI" path here is the same Gemini gateway the rest of the app already uses; with
the toggle off (the default) or no API key configured, this always returns None and the
router falls back to the deterministic template — the same honesty-first pattern as
every other insights endpoint.
"""

import re

import httpx

from core.config import settings
from core.logging import get_logger

log = get_logger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
)

PROMPT_PREFIX = (
    "Reword this personal-finance advice sentence to sound warmer and more natural. "
    "Keep every number, name, and percentage exactly as written — do not add, remove, "
    "or round any of them. Reply with only the reworded sentence, no quotes, no preamble.\n\n"
    "Sentence: "
)

_NUMBER_RE = re.compile(r"\d[\d,]*\.?\d*")


def _numbers_preserved(original: str, reworded: str) -> bool:
    original_numbers = set(_NUMBER_RE.findall(original))
    reworded_numbers = set(_NUMBER_RE.findall(reworded))
    return original_numbers.issubset(reworded_numbers)


async def rephrase(template: str, cloud_enabled: bool) -> str | None:
    if not cloud_enabled or not settings.GEMINI_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": f"{PROMPT_PREFIX}{template}"}]}],
                    "generationConfig": {"temperature": 0.5, "maxOutputTokens": 120},
                },
            )
            resp.raise_for_status()
            data = resp.json()

        text = (
            data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        ).strip()

        if not text or not _numbers_preserved(template, text):
            log.info("Gemini rephrase discarded (empty or altered numbers), using template")
            return None
        return text

    except Exception as e:
        log.warning("Gemini rephrase failed: %s — %s", type(e).__name__, e)
        return None
