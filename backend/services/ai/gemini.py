import json

import httpx

from core.config import settings
from core.logging import get_logger

from .base import BaseAIService, ParseResult

log = get_logger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
)

SYSTEM_PROMPT = """You are a financial transaction parser. Extract structured data from natural language text.

Return ONLY valid JSON with these fields:
- "amount": the monetary value as a number (or null if unclear)
- "description": a clean, capitalized description without the amount
- "type": "expense" or "income"
- "category": one of: Housing, Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Income, Other
- "date": the date in YYYY-MM-DD format if mentioned, otherwise null
- "merchant": the merchant or store name if identifiable, otherwise null
- "confidence": a number 0.0 to 1.0 indicating how confident you are

Examples:
"spent 15 on coffee at Starbucks" → {"amount": 15, "description": "Coffee at Starbucks", "type": "expense", "category": "Food & Dining", "date": null, "merchant": "Starbucks", "confidence": 0.95}
"salary 3200" → {"amount": 3200, "description": "Salary", "type": "income", "category": "Income", "date": null, "merchant": null, "confidence": 0.9}
"walmart 84.23" → {"amount": 84.23, "description": "Walmart", "type": "expense", "category": "Shopping", "date": null, "merchant": "Walmart", "confidence": 0.95}
"netflix" → {"amount": null, "description": "Netflix", "type": "expense", "category": "Entertainment", "date": null, "merchant": "Netflix", "confidence": 0.7}
"amazon headphones 60" → {"amount": 60, "description": "Amazon headphones", "type": "expense", "category": "Shopping", "date": null, "merchant": "Amazon", "confidence": 0.95}
"""


class GeminiService(BaseAIService):
    async def parse(self, text: str) -> ParseResult | None:
        if not settings.GEMINI_API_KEY:
            return None

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\nText: {text}"}]}],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 200,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            text_content = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            cleaned = text_content.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            result = json.loads(cleaned)

            return ParseResult(
                amount=result.get("amount"),
                description=result.get("description", text),
                transaction_type=result.get("type", "expense"),
                category=result.get("category"),
                date=None,
                merchant=result.get("merchant"),
                confidence=result.get("confidence", 0.5),
                raw_text=text,
            )

        except Exception as e:
            log.warning("Gemini parse failed: %s", e)
            return None
