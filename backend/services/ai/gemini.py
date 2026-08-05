import base64
import json
from dataclasses import dataclass

import httpx

from core.config import settings
from core.logging import get_logger

log = get_logger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
)


@dataclass
class ParseResult:
    amount: float | None
    description: str
    transaction_type: str  # "expense" | "income"
    category: str | None
    merchant: str | None
    confidence: float
    raw_text: str


RECEIPT_PROMPT = """You are a receipt/bill scanner. Extract structured data from this image.

Return ONLY valid JSON with these fields:
- "merchant": the store/business name, or null if unreadable
- "date": the transaction date in YYYY-MM-DD format, or null if not visible
- "total": the final total amount as a number, or null if not visible
- "line_items": array of {"description": string, "amount": number}, or null if not itemized/unreadable
- "category_hint": one of: Housing, Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Other
- "confidence": "high", "medium", or "low" — how confident you are this data is accurate

If the image isn't a receipt or bill at all, return every field null and confidence "low".
"""

STATEMENT_PROMPT = """You are a bank/credit-card statement parser. Extract EVERY transaction line.

Return ONLY valid JSON: {"transactions": [ ... ]} where each item has:
- "date": the transaction date in YYYY-MM-DD format (use the statement's year if the row shows only month/day), or null
- "description": the merchant/description text, cleaned
- "amount": the transaction amount as a positive number (never include the running balance)
- "transaction_type": "expense" for purchases/charges/withdrawals, "income" for payments/credits/deposits/refunds
- "category_hint": one of: Housing, Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Other

Include only real transaction rows — skip headers, subtotals, balances, and summary lines.
If this isn't a statement, return {"transactions": []}.
"""

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


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


async def call_gemini(
    parts: list[dict], *, temperature: float, max_tokens: int, timeout: float
) -> str:
    """The single low-level Gemini call for the whole app: POST the given content
    parts and return the model's raw text reply. Raises on transport/HTTP error —
    every caller wraps this in try/except and falls back to its deterministic path,
    so the gateway itself stays a thin, shared primitive (used here plus by the
    chat and rephrase endpoints)."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
            json={
                "contents": [{"parts": parts}],
                "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
            },
        )
        resp.raise_for_status()
        data = resp.json()

    return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


def _inline_image(data: bytes, mime_type: str) -> dict:
    return {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(data).decode("ascii")}}


class GeminiService:
    async def parse(self, text: str) -> ParseResult | None:
        if not settings.GEMINI_API_KEY:
            return None
        try:
            raw = await call_gemini(
                [{"text": f"{SYSTEM_PROMPT}\n\nText: {text}"}],
                temperature=0.1,
                max_tokens=800,
                timeout=15,
            )
            result = json.loads(_strip_json_fences(raw))
            return ParseResult(
                amount=result.get("amount"),
                description=result.get("description", text),
                transaction_type=result.get("type", "expense"),
                category=result.get("category"),
                merchant=result.get("merchant"),
                confidence=result.get("confidence", 0.5),
                raw_text=text,
            )
        except Exception as e:
            log.warning("Gemini parse failed: %s", e)
            return None

    async def extract_receipt(self, image_bytes: bytes, mime_type: str) -> dict | None:
        if not settings.GEMINI_API_KEY:
            return None
        try:
            raw = await call_gemini(
                [{"text": RECEIPT_PROMPT}, _inline_image(image_bytes, mime_type)],
                temperature=0.1,
                max_tokens=800,
                timeout=20,
            )
            return json.loads(_strip_json_fences(raw))
        except Exception as e:
            log.warning("Gemini receipt extraction failed: %s", e)
            return None

    async def extract_statement(self, file_bytes: bytes, mime_type: str) -> dict | None:
        if not settings.GEMINI_API_KEY:
            return None
        try:
            # Statements can be long — allow far more output tokens than a single
            # receipt so a full transaction list isn't truncated.
            raw = await call_gemini(
                [{"text": STATEMENT_PROMPT}, _inline_image(file_bytes, mime_type)],
                temperature=0.1,
                max_tokens=8192,
                timeout=40,
            )
            return json.loads(_strip_json_fences(raw))
        except Exception as e:
            log.warning("Gemini statement extraction failed: %s", e)
            return None
