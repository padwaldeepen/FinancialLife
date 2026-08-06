"""Receipt/bill/statement extraction — backlog.md S2. Two tiers actually exist in this
project today: tier C (local, zero network calls — text-layer extraction for digitally
generated PDFs via pdfplumber, Tesseract OCR for photos/scans) and tier B (Gemini
vision, only when the user's T5 toggle is on). **Tier A (Ollama vision) is not built**
— this project has no Ollama client anywhere yet (tracked separately; S1's ticket note
already flagged this same gap for the "Ollama endpoint" Settings field). Building a
stub tier A here would be exactly the "unfinished implementation" pattern this project
avoids, so the tier order below is B-then-C, and "Ollama absent" is simply the only
state that exists right now — satisfied by construction, not by a placeholder.

Split the same way as `services/insights/`: pure regex/parsing logic here takes no DB
dependency and is independently fixture-testable; the router does the file I/O, the
Gemini call, and the D5 merchant/category enrichment that needs a connection.
"""

import re
from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Literal

import pdfplumber
import pytesseract
from PIL import Image

Tier = Literal["gemini", "tesseract", "pdf_text"]
Confidence = Literal["high", "medium", "low"]


@dataclass
class ExtractedDocument:
    tier: Tier
    confidence: Confidence
    merchant: str | None
    date: date_type | None
    total: Decimal | None
    line_items: list[dict] | None
    category_hint: str | None


@dataclass
class StatementRow:
    """One transaction line off a bank/credit-card statement (S4). `transaction_type`
    is a best-effort guess (a trailing minus / "CR" usually means a credit/payment on a
    card statement); the review screen lets the user flip any of these, so an imperfect
    guess here is corrected before anything is saved."""

    date: date_type | None
    description: str
    amount: Decimal
    transaction_type: Literal["expense", "income"]
    category_hint: str | None


@dataclass
class ExtractedStatement:
    tier: Tier
    transactions: list[StatementRow]


# Amount with either US grouping (1,234.56) or Indian lakh grouping (1,00,000.00) — the
# `(?:,\d{2,3})*` allows 2- or 3-digit comma groups, and commas are stripped after the
# match so both styles normalize the same way. Optional currency marker up front
# (₹ / Rs / INR / $ / C$) so Indian and Canadian documents are recognized, not just US.
_CURRENCY = r"(?:₹|rs\.?\s?|inr\s?|c\$|\$)?"
_AMOUNT_RE = re.compile(_CURRENCY + r"\s?(\d{1,3}(?:,\d{2,3})*\.\d{2})", re.IGNORECASE)
# "amount due" covers utility/rent bills that never say "total" anywhere near the
# actual charge (power/water/rent, per the S2 ticket's original receipt-only scope
# generalized to bills at the user's request) — "previous" excludes a prior balance
# line ("Previous Amount Due") from winning over the current one.
_SKIP_TOTAL_LINE_RE = re.compile(
    r"sub[\s-]?total|tax|change|cash|tender|previous", re.IGNORECASE
)
_TOTAL_LINE_RE = re.compile(r"\btotal\b|amount\s+due", re.IGNORECASE)

_MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        ],
        start=1,
    )
}
_MONTH_NAME_RE = re.compile(
    r"\b(" + "|".join(_MONTHS) + r")\.?\s+(\d{1,2}),?\s+(\d{4})\b", re.IGNORECASE
)

_DATE_PATTERNS = [
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), "%Y-%m-%d"),
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b"), "%m/%d/%Y"),
    (re.compile(r"\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b"), "%m-%d-%Y"),
]

# US and Canada write dates month-first (MM/DD); India (and most of the world) day-first
# (DD/MM). ISO and month-name dates are unambiguous and resolved before this matters.
_DAY_FIRST_COUNTRIES = {"IN"}


def _is_day_first(country: str | None) -> bool:
    return (country or "").upper() in _DAY_FIRST_COUNTRIES


def _resolve_ambiguous_date(a: int, b: int, year: int, day_first: bool) -> date_type | None:
    """Resolve a DD/MM-vs-MM/DD pair using the profile's locale, trying the other order
    as a fallback when the first is impossible (e.g. "15/07" can't be month 15) — this
    auto-corrects an occasional document that doesn't match its profile's convention."""
    primary = (b, a) if day_first else (a, b)  # (month, day)
    fallback = (a, b) if day_first else (b, a)
    for month, day in (primary, fallback):
        try:
            return date_type(year, month, day)
        except ValueError:
            continue
    return None


def _extract_total(lines: list[str]) -> Decimal | None:
    # Prefer an amount on a line that says "total" but isn't "subtotal"/"tax"/etc —
    # otherwise fall back to the largest dollar amount anywhere on the receipt (the
    # grand total is virtually always the largest line item on a real receipt).
    for line in lines:
        if _TOTAL_LINE_RE.search(line) and not _SKIP_TOTAL_LINE_RE.search(line):
            m = _AMOUNT_RE.search(line)
            if m:
                try:
                    return Decimal(m.group(1).replace(",", ""))
                except InvalidOperation:
                    continue

    all_amounts: list[Decimal] = []
    for line in lines:
        for m in _AMOUNT_RE.finditer(line):
            try:
                all_amounts.append(Decimal(m.group(1).replace(",", "")))
            except InvalidOperation:
                continue
    return max(all_amounts) if all_amounts else None


def _extract_date(text: str, country: str | None = None) -> date_type | None:
    # ISO (YYYY-MM-DD) and "August 05, 2026" are unambiguous — resolved first. The
    # slash/dash patterns are DD/MM-vs-MM/DD ambiguous, so they're interpreted by the
    # profile's locale (India = day-first; US/CA = month-first), with an auto-swap
    # fallback when the primary order is an impossible date.
    iso_pattern, _ = _DATE_PATTERNS[0]
    m = iso_pattern.search(text)
    if m:
        try:
            return date_type(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    m = _MONTH_NAME_RE.search(text)
    if m:
        try:
            return date_type(int(m.group(3)), _MONTHS[m.group(1).lower()], int(m.group(2)))
        except ValueError:
            pass

    day_first = _is_day_first(country)
    for pattern, _fmt in _DATE_PATTERNS[1:]:
        m = pattern.search(text)
        if not m:
            continue
        year = m.group(3)
        year = f"20{year}" if len(year) == 2 else year
        resolved = _resolve_ambiguous_date(int(m.group(1)), int(m.group(2)), int(year), day_first)
        if resolved is not None:
            return resolved
    return None


def _extract_merchant(lines: list[str]) -> str | None:
    # Receipts put the merchant name at the top, virtually always — first line with
    # real alphabetic content (not a lone digit/symbol row) is the best zero-context
    # guess without an LLM.
    for line in lines[:5]:
        stripped = line.strip()
        letters = sum(1 for c in stripped if c.isalpha())
        if letters >= 3:
            return stripped
    return None


# Keyword → system-category name (matches services/category_service.py's seed tree;
# subcategory names preferred for precision, they resolve via the router's
# _category_from_hint name lookup, falling back to the parent if the exact sub is gone).
# Ordered most-specific first — the first keyword found in the document text wins, so a
# "tampa electric" bill lands on "Electric", not a generic "Bills & Utilities". This is
# the tier-C (no-LLM) counterpart to Gemini's own category_hint; deterministic rules,
# no guessing beyond a keyword actually appearing on the page.
# Includes India/Canada merchants + services alongside US ones (N1) — statement lines
# there often read "UPI-ZOMATO", "IMPS/AIRTEL", etc., and substring matching catches them.
_CATEGORY_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    # N2: money sent home — checked first so a "WISE/REMITLY" transfer lands here rather
    # than being mis-tagged by an incidental keyword elsewhere in the line.
    (("wise", "transferwise", "remitly", "xoom", "western union", "moneygram", "worldremit", "ria money", "remittance"), "Money Sent Home"),
    (("electric", "energy", "kwh", "kilowatt", "power company", "teco", "duke energy", "hydro", "bescom", "adani electric", "tata power"), "Electric"),
    (("water", "sewer", "aqua", "utilit"), "Water"),
    (("internet", "comcast", "xfinity", "spectrum", "broadband", "fiber", "jiofiber", "act fibernet"), "Internet"),
    (("wireless", "verizon", "t-mobile", "at&t", "cellular", "phone bill", "airtel", "jio", "vodafone", "bsnl", "recharge"), "Phone"),
    (("mortgage",), "Mortgage"),
    (("rent ", "lease", "apartment", "landlord", "property manage"), "Rent"),
    (("netflix", "spotify", "hulu", "disney+", "hbo", "streaming", "hotstar", "jiocinema", "sonyliv"), "Streaming"),
    (("starbucks", "dunkin", "coffee", "chai", "tim hortons"), "Coffee Shops"),
    (("costco", "walmart", "kroger", "safeway", "aldi", "whole foods", "trader joe", "grocery", "groceries", "bigbasket", "blinkit", "zepto", "dmart", "reliance fresh", "loblaws", "sobeys"), "Groceries"),
    (("restaurant", "cafe", "grill", "pizza", "mcdonald", "chipotle", "diner", "dining", "zomato", "swiggy", "dominos"), "Dining Out"),
    (("uber", "lyft", "rideshare", "ola", "rapido"), "Rideshare"),
    (("shell", "chevron", "exxon", "mobil", "gas station", "fuel", "petrol", "indian oil", "hpcl", "bharat petroleum"), "Gas"),
    (("parking", "fastag", "toll"), "Parking"),
    (("pharmacy", "cvs", "walgreens", "rite aid", "apollo pharmacy", "1mg", "pharmeasy", "shoppers drug"), "Pharmacy"),
    (("gym", "fitness", "planet fitness", "cult.fit", "cultfit"), "Gym"),
    (("doctor", "clinic", "medical", "hospital", "dental"), "Doctor"),
    (("amazon", "target", "ebay", "best buy", "flipkart", "myntra", "ajio", "meesho"), "Online"),
]


def infer_category_hint(raw_text: str) -> str | None:
    haystack = raw_text.lower()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(kw in haystack for kw in keywords):
            return category
    return None


def parse_receipt_text(
    raw_text: str, tier: Tier = "tesseract", country: str | None = None
) -> ExtractedDocument:
    """Pure regex/heuristic pass over already-extracted text — split out from
    `extract_local` so the heuristics are fixture-testable without a real image/PDF or
    the tesseract binary. `tier` only affects the confidence ceiling: OCR'd text can
    misread characters (a genuine recognition error), so it never claims "high"; a
    PDF's text layer is exact — no recognition step, just parsing — so it can. `country`
    (the profile's) drives DD/MM-vs-MM/DD date interpretation (N1)."""
    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    total = _extract_total(lines)
    date = _extract_date(raw_text, country)
    merchant = _extract_merchant(lines)

    # Honesty rule (design-system.md "transparent AI", same principle as I3/I4/I5).
    found_both = total is not None and date is not None
    if not found_both:
        confidence: Confidence = "low"
    else:
        confidence = "high" if tier == "pdf_text" else "medium"

    return ExtractedDocument(
        tier=tier,
        confidence=confidence,
        merchant=merchant,
        date=date,
        total=total,
        line_items=None,  # Flat text has no reliable per-item structure in either tier.
        category_hint=infer_category_hint(raw_text),  # keyword rules, no LLM (S2 follow-up)
    )


def extract_raw_text(file_path: Path, mime_type: str) -> tuple[str, Tier]:
    """Shared local text extraction — pdfplumber for a PDF's text layer, Tesseract OCR
    for a photo/scan. Both `extract_local` and `extract_statement_local` need exactly
    this (previously duplicated in each); also the one text source W6's kind
    auto-detection classifies against, so it only runs once per upload."""
    if mime_type == "application/pdf":
        text_parts: list[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts), "pdf_text"

    image = Image.open(file_path)
    return pytesseract.image_to_string(image), "tesseract"


def guess_document_kind(raw_text: str) -> Literal["receipt", "statement"]:
    """W6: local-tier, zero-cost kind classification from already-extracted text — 3+
    lines matching the statement row shape (date-led, followed by an amount) means a
    statement; otherwise a receipt. Runs on the same text `extract_local`/
    `extract_statement_local` already produce, so classifying costs nothing extra."""
    row_matches = 0
    for line in raw_text.splitlines():
        date_match = _STMT_ROW_DATE.match(line)
        if date_match and _STMT_ROW_AMOUNT.search(date_match.group(4)):
            row_matches += 1
            if row_matches >= 3:
                return "statement"
    return "receipt"


def extract_local(
    file_path: Path, mime_type: str, country: str | None = None
) -> ExtractedDocument:
    raw_text, tier = extract_raw_text(file_path, mime_type)

    if not raw_text.strip():
        # A scanned PDF (image-only, no text layer) — pdfplumber correctly finds
        # nothing to extract. Honest empty result, not a guess; page-rasterization
        # + Tesseract for this case is a further improvement, not built here.
        return ExtractedDocument(
            tier=tier,
            confidence="low",
            merchant=None,
            date=None,
            total=None,
            line_items=None,
            category_hint=None,
        )
    return parse_receipt_text(raw_text, tier=tier, country=country)


_VALID_CONFIDENCE = {"high", "medium", "low"}


def _from_gemini_result(result: dict) -> ExtractedDocument | None:
    """Never trust an LLM's JSON blindly — coerce every field defensively and return
    None (triggering the tier C fallback) if the shape is too broken to use, rather
    than propagating a malformed amount/date into `documents.extracted_json`."""
    total: Decimal | None = None
    if result.get("total") is not None:
        try:
            total = Decimal(str(result["total"]))
        except InvalidOperation:
            return None

    date: date_type | None = None
    if result.get("date"):
        try:
            date = date_type.fromisoformat(str(result["date"]))
        except ValueError:
            date = None  # Unparseable date isn't fatal — the rest may still be usable.

    line_items = result.get("line_items")
    if not isinstance(line_items, list):
        line_items = None

    confidence = result.get("confidence")
    if confidence not in _VALID_CONFIDENCE:
        confidence = "low"

    return ExtractedDocument(
        tier="gemini",
        confidence=confidence,
        merchant=result.get("merchant") or None,
        date=date,
        total=total,
        line_items=line_items,
        category_hint=result.get("category_hint") or None,
    )


async def extract(
    file_path: Path,
    mime_type: str,
    cloud_enabled: bool,
    ai_service,
    country: str | None = None,
) -> ExtractedDocument:
    """Tier order: Gemini (only if the user's T5 toggle is on) → Tesseract (always
    available, zero network calls). `ai_service` is this project's single cloud-AI
    gateway (`services/ai/ai_service.py`) — passed in rather than imported as a
    module-level singleton here, so this stays a plain function callable from a
    fixture without needing to fake global state. `country` (profile's) drives the
    local tier's date locale (N1); Gemini infers locale from the document itself."""
    if cloud_enabled:
        image_bytes = file_path.read_bytes()
        gemini_result = await ai_service.extract_receipt(image_bytes, mime_type, cloud_enabled)
        if gemini_result is not None:
            parsed = _from_gemini_result(gemini_result)
            if parsed is not None:
                return parsed

    return extract_local(file_path, mime_type, country)


# --- Statement mode (S4) -------------------------------------------------------------

# A statement row: a leading MM/DD[/YY[YY]] date, then description, then the transaction
# amount. We take the FIRST currency amount after the description (not the last), because
# bank statements append a running-balance column — the first number is the transaction,
# the trailing one is the balance. Credit-card statements have a single amount, so first
# == only. Genuinely ambiguous cases are why tier B (LLM) exists and why every row is
# user-reviewed before saving.
_STMT_ROW_DATE = re.compile(r"^\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.+)$")
# Locale-tolerant like _AMOUNT_RE (₹/Rs/INR/$/C$ + US or Indian grouping). A trailing
# "CR" marks a credit/payment (income); "DR"/plain/leading-"-" is a debit (expense).
_STMT_ROW_AMOUNT = re.compile(
    r"(-)?" + _CURRENCY + r"\s?(\d{1,3}(?:,\d{2,3})*\.\d{2})(-|\s?cr|\s?dr)?",
    re.IGNORECASE,
)
_STMT_SKIP_LINE = re.compile(
    r"\b(beginning|ending|previous|new|total|minimum|balance|payment due|"
    r"available|credit limit|statement|account\s*number|page)\b",
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r"\b(20\d{2})\b")


def _statement_fallback_year(raw_text: str) -> int | None:
    m = _YEAR_RE.search(raw_text)
    return int(m.group(1)) if m else None


def parse_statement_text(
    raw_text: str, tier: Tier = "pdf_text", country: str | None = None
) -> ExtractedStatement:
    """Pure row parser over already-extracted statement text — no I/O, fixture-testable.
    Emits a best-effort draft the review screen refines; never the final word. `country`
    (profile's) drives DD/MM-vs-MM/DD interpretation of each row's date (N1)."""
    fallback_year = _statement_fallback_year(raw_text)
    day_first = _is_day_first(country)
    rows: list[StatementRow] = []

    for line in raw_text.splitlines():
        if not line.strip() or _STMT_SKIP_LINE.search(line):
            continue
        date_match = _STMT_ROW_DATE.match(line)
        if not date_match:
            continue
        date_a, date_b, yy, rest = date_match.groups()

        amt_match = _STMT_ROW_AMOUNT.search(rest)
        if not amt_match:
            continue
        neg_lead, amt_str, credit_trail = amt_match.groups()
        try:
            amount = Decimal(amt_str.replace(",", ""))
        except InvalidOperation:
            continue
        if amount <= 0:
            continue

        description = rest[: amt_match.start()].strip(" .-\t")
        if sum(c.isalpha() for c in description) < 2:
            continue  # a row with no real description is noise, not a transaction

        # A leading "-", or a trailing "-"/"CR", marks a credit/payment (money in); a
        # trailing "DR" (or nothing) is a debit — the default expense. US card statements
        # use the trailing "-"; Indian bank statements use CR/DR explicitly.
        trail = (credit_trail or "").strip().lower()
        is_credit = bool(neg_lead) or trail in ("-", "cr")
        transaction_type: Literal["expense", "income"] = "income" if is_credit else "expense"

        year = int(yy) if yy else fallback_year
        if year is not None and year < 100:
            year = 2000 + year
        row_date: date_type | None = None
        if year is not None:
            row_date = _resolve_ambiguous_date(int(date_a), int(date_b), year, day_first)

        rows.append(
            StatementRow(
                date=row_date,
                description=description,
                amount=amount,
                transaction_type=transaction_type,
                category_hint=infer_category_hint(description),
            )
        )

    return ExtractedStatement(tier=tier, transactions=rows)


def _statement_from_gemini(result: dict) -> ExtractedStatement | None:
    raw_rows = result.get("transactions")
    if not isinstance(raw_rows, list):
        return None
    rows: list[StatementRow] = []
    for r in raw_rows:
        if not isinstance(r, dict) or r.get("amount") is None:
            continue
        try:
            amount = Decimal(str(r["amount"]))
        except InvalidOperation:
            continue
        if amount <= 0:
            continue
        row_date: date_type | None = None
        if r.get("date"):
            try:
                row_date = date_type.fromisoformat(str(r["date"]))
            except ValueError:
                row_date = None
        ttype = r.get("transaction_type")
        transaction_type: Literal["expense", "income"] = (
            "income" if ttype == "income" else "expense"
        )
        description = str(r.get("description") or "").strip()
        rows.append(
            StatementRow(
                date=row_date,
                description=description,
                amount=amount,
                transaction_type=transaction_type,
                category_hint=r.get("category_hint") or infer_category_hint(description),
            )
        )
    return ExtractedStatement(tier="gemini", transactions=rows)


def extract_statement_local(
    file_path: Path, mime_type: str, country: str | None = None
) -> ExtractedStatement:
    raw_text, tier = extract_raw_text(file_path, mime_type)
    return parse_statement_text(raw_text, tier=tier, country=country)


async def extract_statement(
    file_path: Path,
    mime_type: str,
    cloud_enabled: bool,
    ai_service,
    country: str | None = None,
) -> ExtractedStatement:
    """Same tier order as `extract`: Gemini (toggle on) → local pdfplumber/regex."""
    if cloud_enabled:
        image_bytes = file_path.read_bytes()
        gemini_result = await ai_service.extract_statement(image_bytes, mime_type, cloud_enabled)
        if gemini_result is not None:
            parsed = _statement_from_gemini(gemini_result)
            if parsed is not None and parsed.transactions:
                return parsed

    return extract_statement_local(file_path, mime_type, country)
