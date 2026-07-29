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


_AMOUNT_RE = re.compile(r"\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})")
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


def _extract_date(text: str) -> date_type | None:
    # ISO (YYYY-MM-DD) is unambiguous; the other two patterns are both interpreted as
    # MM/DD/YYYY (or MM-DD-YYYY) since that's the dominant receipt format in this
    # project's target locales (US/CA) — genuinely ambiguous with DD/MM elsewhere, but
    # a wrong-but-plausible date beats silently picking the "other" locale at random.
    iso_pattern, _ = _DATE_PATTERNS[0]
    m = iso_pattern.search(text)
    if m:
        try:
            return date_type(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    # "August 05, 2026" — as unambiguous as ISO (no MM/DD-vs-DD/MM guessing), and the
    # dominant date format on bills/statements (rent, utilities) as opposed to receipts.
    m = _MONTH_NAME_RE.search(text)
    if m:
        try:
            return date_type(int(m.group(3)), _MONTHS[m.group(1).lower()], int(m.group(2)))
        except ValueError:
            pass

    for pattern, _fmt in _DATE_PATTERNS[1:]:
        m = pattern.search(text)
        if not m:
            continue
        year = m.group(3)
        year = f"20{year}" if len(year) == 2 else year
        try:
            return date_type(int(year), int(m.group(1)), int(m.group(2)))
        except ValueError:
            continue
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
_CATEGORY_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    (("electric", "energy", "kwh", "kilowatt", "power company", "teco", "duke energy"), "Electric"),
    (("water", "sewer", "aqua", "utilit"), "Water"),
    (("internet", "comcast", "xfinity", "spectrum", "broadband", "fiber"), "Internet"),
    (("wireless", "verizon", "t-mobile", "at&t", "cellular", "phone bill"), "Phone"),
    (("mortgage",), "Mortgage"),
    (("rent ", "lease", "apartment", "landlord", "property manage"), "Rent"),
    (("netflix", "spotify", "hulu", "disney+", "hbo", "streaming"), "Streaming"),
    (("starbucks", "dunkin", "coffee"), "Coffee Shops"),
    (("costco", "walmart", "kroger", "safeway", "aldi", "whole foods", "trader joe", "grocery", "groceries"), "Groceries"),
    (("restaurant", "cafe", "grill", "pizza", "mcdonald", "chipotle", "diner", "dining"), "Dining Out"),
    (("uber", "lyft", "rideshare"), "Rideshare"),
    (("shell", "chevron", "exxon", "mobil", "gas station", "fuel"), "Gas"),
    (("parking",), "Parking"),
    (("pharmacy", "cvs", "walgreens", "rite aid"), "Pharmacy"),
    (("gym", "fitness", "planet fitness"), "Gym"),
    (("doctor", "clinic", "medical", "hospital", "dental"), "Doctor"),
    (("amazon", "target", "ebay", "best buy"), "Online"),
]


def infer_category_hint(raw_text: str) -> str | None:
    haystack = raw_text.lower()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(kw in haystack for kw in keywords):
            return category
    return None


def parse_receipt_text(raw_text: str, tier: Tier = "tesseract") -> ExtractedDocument:
    """Pure regex/heuristic pass over already-extracted text — split out from
    `extract_local` so the heuristics are fixture-testable without a real image/PDF or
    the tesseract binary. `tier` only affects the confidence ceiling: OCR'd text can
    misread characters (a genuine recognition error), so it never claims "high"; a
    PDF's text layer is exact — no recognition step, just parsing — so it can."""
    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    total = _extract_total(lines)
    date = _extract_date(raw_text)
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


def extract_local(file_path: Path, mime_type: str) -> ExtractedDocument:
    if mime_type == "application/pdf":
        text_parts: list[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        raw_text = "\n".join(text_parts)

        if not raw_text.strip():
            # A scanned PDF (image-only, no text layer) — pdfplumber correctly finds
            # nothing to extract. Honest empty result, not a guess; page-rasterization
            # + Tesseract for this case is a further improvement, not built here.
            return ExtractedDocument(
                tier="pdf_text",
                confidence="low",
                merchant=None,
                date=None,
                total=None,
                line_items=None,
                category_hint=None,
            )
        return parse_receipt_text(raw_text, tier="pdf_text")

    image = Image.open(file_path)
    raw_text = pytesseract.image_to_string(image)
    return parse_receipt_text(raw_text, tier="tesseract")


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
) -> ExtractedDocument:
    """Tier order: Gemini (only if the user's T5 toggle is on) → Tesseract (always
    available, zero network calls). `ai_service` is this project's single cloud-AI
    gateway (`services/ai/ai_service.py`) — passed in rather than imported as a
    module-level singleton here, so this stays a plain function callable from a
    fixture without needing to fake global state."""
    if cloud_enabled:
        image_bytes = file_path.read_bytes()
        gemini_result = await ai_service.extract_receipt(image_bytes, mime_type, cloud_enabled)
        if gemini_result is not None:
            parsed = _from_gemini_result(gemini_result)
            if parsed is not None:
                return parsed

    return extract_local(file_path, mime_type)


# --- Statement mode (S4) -------------------------------------------------------------

# A statement row: a leading MM/DD[/YY[YY]] date, then description, then the transaction
# amount. We take the FIRST currency amount after the description (not the last), because
# bank statements append a running-balance column — the first number is the transaction,
# the trailing one is the balance. Credit-card statements have a single amount, so first
# == only. Genuinely ambiguous cases are why tier B (LLM) exists and why every row is
# user-reviewed before saving.
_STMT_ROW_DATE = re.compile(r"^\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.+)$")
_STMT_ROW_AMOUNT = re.compile(r"(-)?\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})(-|\s?CR)?", re.IGNORECASE)
_STMT_SKIP_LINE = re.compile(
    r"\b(beginning|ending|previous|new|total|minimum|balance|payment due|"
    r"available|credit limit|statement|account\s*number|page)\b",
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r"\b(20\d{2})\b")


def _statement_fallback_year(raw_text: str) -> int | None:
    m = _YEAR_RE.search(raw_text)
    return int(m.group(1)) if m else None


def parse_statement_text(raw_text: str, tier: Tier = "pdf_text") -> ExtractedStatement:
    """Pure row parser over already-extracted statement text — no I/O, fixture-testable.
    Emits a best-effort draft the review screen refines; never the final word."""
    fallback_year = _statement_fallback_year(raw_text)
    rows: list[StatementRow] = []

    for line in raw_text.splitlines():
        if not line.strip() or _STMT_SKIP_LINE.search(line):
            continue
        date_match = _STMT_ROW_DATE.match(line)
        if not date_match:
            continue
        mm, dd, yy, rest = date_match.groups()

        amt_match = _STMT_ROW_AMOUNT.search(rest)
        if not amt_match:
            continue
        neg_lead, amt_str, cr_trail = amt_match.groups()
        try:
            amount = Decimal(amt_str.replace(",", ""))
        except InvalidOperation:
            continue
        if amount <= 0:
            continue

        description = rest[: amt_match.start()].strip(" .-\t")
        if sum(c.isalpha() for c in description) < 2:
            continue  # a row with no real description is noise, not a transaction

        # Trailing "-" or "CR", or a leading "-", marks a credit/payment (money in on a
        # card statement); everything else defaults to expense.
        is_credit = bool(neg_lead) or bool(cr_trail and cr_trail.strip())
        transaction_type: Literal["expense", "income"] = "income" if is_credit else "expense"

        year = int(yy) if yy else fallback_year
        if year is not None and year < 100:
            year = 2000 + year
        row_date: date_type | None = None
        if year is not None:
            try:
                row_date = date_type(year, int(mm), int(dd))
            except ValueError:
                row_date = None

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


def extract_statement_local(file_path: Path, mime_type: str) -> ExtractedStatement:
    if mime_type != "application/pdf":
        # Statements are effectively always PDFs; an image "statement" would need OCR
        # first — out of scope for tier C here, so return nothing to import rather than
        # a bad guess. (A user can still upload it as a single receipt.)
        image = Image.open(file_path)
        raw_text = pytesseract.image_to_string(image)
        return parse_statement_text(raw_text, tier="tesseract")

    text_parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return parse_statement_text("\n".join(text_parts), tier="pdf_text")


async def extract_statement(
    file_path: Path,
    mime_type: str,
    cloud_enabled: bool,
    ai_service,
) -> ExtractedStatement:
    """Same tier order as `extract`: Gemini (toggle on) → local pdfplumber/regex."""
    if cloud_enabled:
        image_bytes = file_path.read_bytes()
        gemini_result = await ai_service.extract_statement(image_bytes, mime_type, cloud_enabled)
        if gemini_result is not None:
            parsed = _statement_from_gemini(gemini_result)
            if parsed is not None and parsed.transactions:
                return parsed

    return extract_statement_local(file_path, mime_type)
