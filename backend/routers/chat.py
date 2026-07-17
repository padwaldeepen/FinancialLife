import re
from datetime import datetime, timedelta

import asyncpg
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.config import settings
from core.logging import get_logger
from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from services.transaction_service import parse_transaction

log = get_logger(__name__)

router = APIRouter()


class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    transaction_created: bool = False
    transaction_data: dict | None = None


def _looks_like_transaction(text: str) -> bool:
    lower = text.lower().strip()
    tx_starters = [
        "spent",
        "paid",
        "bought",
        "got",
        "earned",
        "received",
        "coffee",
        "lunch",
        "dinner",
        "uber",
        "grocery",
        "walmart",
        "amazon",
        "netflix",
        "rent",
        "salary",
        "gas",
        "food",
    ]
    has_amount = any(c.isdigit() for c in lower)
    has_keyword = any(lower.startswith(kw) or f" {kw} " in lower for kw in tx_starters)
    return has_amount and (has_keyword or len(lower.split()) <= 4)


async def _get_profile_summary(conn: asyncpg.Connection, profile_id: int) -> str:
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    this_month_income = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'income' AND date >= $2""",
                profile_id,
                month_start,
            )
        ),
        2,
    )
    this_month_expense = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'expense' AND date >= $2""",
                profile_id,
                month_start,
            )
        ),
        2,
    )
    prev_income = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'income'
                     AND date >= $2 AND date < $3""",
                profile_id,
                last_month_start,
                month_start,
            )
        ),
        2,
    )
    prev_expense = round(
        float(
            await conn.fetchval(
                """SELECT COALESCE(SUM(amount), 0) FROM transactions
                   WHERE profile_id = $1 AND transaction_type = 'expense'
                     AND date >= $2 AND date < $3""",
                profile_id,
                last_month_start,
                month_start,
            )
        ),
        2,
    )
    tx_count = await conn.fetchval(
        "SELECT COUNT(*) FROM transactions WHERE profile_id = $1 AND date >= $2",
        profile_id,
        month_start,
    )

    top_cat_rows = await conn.fetch(
        """SELECT c.name, SUM(t.amount) AS total
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.profile_id = $1 AND t.transaction_type = 'expense'
             AND t.category_id IS NOT NULL AND t.date >= $2
           GROUP BY c.name ORDER BY SUM(t.amount) DESC LIMIT 3""",
        profile_id,
        month_start,
    )
    top_cats = [f"{r['name']}: ${float(r['total']):.2f}" for r in top_cat_rows if r["name"]]

    return (
        f"This month: Income ${this_month_income:.2f}, Expenses ${this_month_expense:.2f}, "
        f"Net ${this_month_income - this_month_expense:.2f}. "
        f"Last month: Income ${prev_income:.2f}, Expenses ${prev_expense:.2f}. "
        f"Transactions this month: {tx_count}. "
        f"Top categories: {', '.join(top_cats) if top_cats else 'none'}."
    )


SYSTEM_PROMPT = (
    "You are a friendly financial assistant for a personal finance app called My Financial Life. "
    "You can help users understand their spending, income, and budgets. "
    "Be concise, warm, and helpful. Use dollar amounts when relevant. "
    "Keep responses to 2-3 short sentences."
)


GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
)


async def _ask_llm(question: str, user_summary: str, cloud_enabled: bool) -> str:
    if not cloud_enabled or not settings.GEMINI_API_KEY:
        return _answer_from_data(question, user_summary)

    user_msg = (
        f"{SYSTEM_PROMPT}\n\nUser's current financial summary:\n{user_summary}\n\n"
        f"User's question: {question}"
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": user_msg}]}],
                    "generationConfig": {"temperature": 0.4, "maxOutputTokens": 300},
                },
            )
            resp.raise_for_status()
            data = resp.json()

        text = (
            data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        ).strip()
        return text or "I couldn't generate a response. Please try again."

    except Exception as e:
        log.warning("Gemini chat failed: %s — %s", type(e).__name__, e)
        return _answer_from_data(question, user_summary)


def _answer_from_data(question: str, summary: str) -> str:
    lower = question.lower()

    income = expense = net = 0.0

    m = re.search(r"Income \$([0-9,.]+)", summary)
    if m:
        income = float(m.group(1).replace(",", ""))
    m = re.search(r"Expenses \$([0-9,.]+)", summary)
    if m:
        expense = float(m.group(1).replace(",", ""))
    m = re.search(r"Net \$(-?[0-9,.]+)", summary)
    if m:
        net = float(m.group(1).replace(",", ""))

    if any(w in lower for w in ["income", "earn", "salary", "make"]):
        return f"Your income this month is ${income:,.2f}."
    if any(w in lower for w in ["spend", "expense", "spent", "cost"]):
        return f"You've spent ${expense:,.2f} so far this month."
    if any(w in lower for w in ["save", "net", "balance", "left"]):
        label = "saved" if net >= 0 else "overspent"
        return f"You've {label} ${abs(net):,.2f} this month (income minus expenses)."
    if any(w in lower for w in ["category", "top", "most"]):
        return f"Your top spending categories are listed in your summary. {summary}"
    if any(w in lower for w in ["budget", "plan"]):
        return (
            f"Budgeting tip: You've spent ${expense:,.2f} this month. "
            f"Try the 50/30/20 rule — 50% needs, 30% wants, 20% savings."
        )

    return (
        f"Here's your summary: You've earned ${income:,.2f} and spent ${expense:,.2f} "
        f"this month (net ${net:,.2f}). Ask me about income, expenses, savings, "
        f"or budgeting tips!"
    )


@router.post("/", response_model=ChatResponse)
async def chat(
    msg: ChatMessage,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    text = msg.message.strip()

    if _looks_like_transaction(text):
        parsed = parse_transaction(text)
        if parsed.get("amount"):
            return ChatResponse(
                reply=(
                    f"Got it! I'll log that as: "
                    f"**{parsed['description']}** — ${parsed['amount']:.2f} "
                    f"({parsed['type']}, {parsed.get('category', 'Other')}). "
                    f"Click 'Save' to confirm."
                ),
                transaction_created=False,
                transaction_data=parsed,
            )
        else:
            return ChatResponse(
                reply=(
                    "I think that's a transaction, but I couldn't detect the amount. "
                    "Could you include a number? For example: 'spent 15 on coffee'."
                )
            )

    summary = await _get_profile_summary(conn, profile.id)
    user_row = await conn.fetchrow(
        "SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id
    )
    reply = await _ask_llm(text, summary, cloud_enabled=user_row["ai_cloud_enabled"])

    return ChatResponse(reply=reply)
