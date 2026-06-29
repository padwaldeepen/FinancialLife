from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ParseResult:
    amount: float | None
    description: str
    transaction_type: str  # "expense" | "income"
    category: str | None
    date: datetime | None
    merchant: str | None
    confidence: float
    raw_text: str


class BaseAIService(ABC):
    @abstractmethod
    async def parse(self, text: str) -> ParseResult | None: ...
