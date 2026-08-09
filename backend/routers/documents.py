"""Document storage — backlog.md S1 — plus S2's extraction wiring and S3's review
screen. S3: nothing auto-commits — extraction only ever pre-fills a form; the user
reviews/edits it, and only `POST /{id}/review` actually creates a transaction, running
the same D3 dedup gate (`services/ingest/dedup.py`) every other import path uses.
"""

import asyncio
import hashlib
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Literal

import asyncpg
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.config import settings
from core.logging import get_logger
from core.money import Money
from database.models import MAX_MONEY_AMOUNT, Profile
from database.session import get_db
from routers.auth import get_current_profile
from routers.transactions import FuzzyMatchInfo
from services.ai.ai_service import AIService
from services.ai.consent import cloud_enabled
from services.category_service import get_valid_category_ids
from services.ingest.dedup import DedupCandidate, compute_import_hash, find_duplicates
from services.ingest.document_extract import (
    ExtractedDocument,
    extract,
    extract_raw_text,
    extract_statement,
    guess_document_kind,
)
from services.ingest.refunds import find_refund_original
from services.merchant_service import (
    extract_merchant_from_description,
    find_matching_merchant,
    find_or_create_merchant,
    normalize_name,
)
from services.transaction_service import check_category_owned, check_related_ids_owned

log = get_logger(__name__)

router = APIRouter()
ai_service = AIService()

# Extension is derived from the validated content-type, never from the client-supplied
# filename — the stored path is always the uuid one we generate (architecture-and-goals.md:
# "path never client-controlled"). X1 keeps the original filename as a *display-only*
# column so the document library can show what a file is; it never re-enters path
# construction, and `_display_filename` below strips it to a bare basename regardless.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}

# X3: types we will *store and list* but never try to understand. A folder upload
# unavoidably contains warranties, letters, notes and tax forms; before this, every one
# of them came back as a red "Failed" row that read like a bug in the app rather than an
# honest "this isn't a receipt". They get `kind='other'`, skip extraction entirely, and
# never become a transaction.
#
# **Tax documents are deliberately not special-cased** (owner's call, 2026-08-08, and
# plan.md's standing "no tax filing or tax documents" exclusion): a W-2 / 1099 / Form 16 /
# T4 is just an `other` document like any other — stored, listed, never parsed.
STORE_ONLY_CONTENT_TYPES: dict[str, str] = {
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

DocumentKind = Literal["receipt", "bill", "statement", "other"]

# Longest filename we'll keep. Nothing depends on the full string — it's shown in a
# table cell — so a pathological 4KB name gets cut rather than stored.
MAX_FILENAME_LENGTH = 255


def _display_filename(raw: str | None) -> str | None:
    """Reduce a client-supplied filename to something safe to store and show.

    Defence-in-depth, not the primary control: this value is never used to build a path
    (the uuid name is), but a folder upload sends relative paths like
    `statements/2024/jan.pdf`, and a hostile client can send `../../etc/passwd` or
    embedded NULs. Take the last path component under either separator, drop control
    characters, and cap the length.
    """
    if not raw:
        return None
    last = raw.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(ch for ch in last if ch.isprintable()).strip()
    # A name that was *only* separators/dots ("..", "/") carries no information and
    # would render as a confusing row — treat it as absent so the UI falls back.
    if not cleaned or cleaned in (".", ".."):
        return None
    return cleaned[:MAX_FILENAME_LENGTH]


class DocumentResponse(BaseModel):
    id: int
    kind: str
    mime_type: str
    status: str
    uploaded_at: str
    # X1: NULL for anything uploaded before migration 0006 — the UI falls back to
    # "Untitled document" rather than showing the uuid on disk.
    original_filename: str | None = None


class PendingDocumentResponse(DocumentResponse):
    extracted_json: dict | None


class LibraryDocumentResponse(PendingDocumentResponse):
    """X1: a row in the document library — every document, not just the review queue.

    Both link fields are the reverse of `transactions.document_id`. A receipt yields
    exactly one transaction, but a statement import yields many, so the count is carried
    alongside the id: the UI deep-links a single transaction and otherwise says how many
    came out of that document.
    """

    linked_transaction_id: int | None = None
    linked_transaction_count: int = 0


class DocumentReviewRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    description: str
    transaction_type: Literal["income", "expense"] = "expense"
    account_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    date: datetime
    notes: str | None = None
    # Set on resubmit after the user picked "keep both" for a fuzzy match — same
    # semantics as TransactionImport.skip_dedup (U4).
    skip_dedup: bool = False


class DocumentReviewResponse(BaseModel):
    status: Literal["created", "exact_duplicate", "fuzzy_duplicate"]
    transaction_id: int | None = None
    fuzzy_matches: list[FuzzyMatchInfo] = []


class StatementRowStatus(BaseModel):
    row_index: int
    date: str | None
    description: str
    amount: Money
    transaction_type: str
    category_id: int | None
    category_hint: str | None
    # Dedup verdict against the profile's existing transactions, computed at review
    # time so the UI can default-uncheck exact dupes and flag fuzzy ones (the whole
    # point of S4 — re-uploading overlapping statement months must not double-count).
    dedup_status: Literal["exact", "fuzzy", "none"]


class StatementReviewResponse(BaseModel):
    tier: str | None
    rows: list[StatementRowStatus]


class StatementImportRow(BaseModel):
    date: datetime
    description: str
    amount: Decimal = Field(gt=0, le=MAX_MONEY_AMOUNT)
    transaction_type: Literal["income", "expense"] = "expense"
    category_id: int | None = None
    # The user unchecked exact dupes in the UI; only checked rows are sent. skip_dedup
    # lets a deliberately-kept fuzzy match through (same "keep both" semantics as U4/S3).
    skip_dedup: bool = False


class StatementImportRequest(BaseModel):
    account_id: int  # all rows post to one account, chosen once in the review UI
    rows: list[StatementImportRow] = Field(max_length=2000)


class StatementImportResponse(BaseModel):
    imported: int
    skipped: int


def _upload_dir(user_id: int) -> Path:
    d = Path(settings.UPLOAD_DIR) / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


async def _category_from_merchant_history(
    profile_id: int, merchant_id: int, conn: asyncpg.Connection
) -> int | None:
    row = await conn.fetchrow(
        """SELECT category_id FROM transactions
           WHERE profile_id = $1 AND merchant_id = $2 AND category_id IS NOT NULL
           GROUP BY category_id ORDER BY COUNT(*) DESC LIMIT 1""",
        profile_id,
        merchant_id,
    )
    return row["category_id"] if row else None


async def _category_from_hint(user_id: int, hint: str, conn: asyncpg.Connection) -> int | None:
    row = await conn.fetchrow(
        """SELECT id FROM categories
           WHERE (user_id = $1 OR is_system) AND lower(name) = lower($2)
           LIMIT 1""",
        user_id,
        hint,
    )
    return row["id"] if row else None


async def _extract_and_store(
    document_id: int,
    file_path: Path,
    mime_type: str,
    kind: str,
    profile: Profile,
    conn: asyncpg.Connection,
) -> None:
    """Best-effort: any failure here leaves `extracted_json` null and the document
    still `pending` — the review screen can always fall back to manual entry against
    the raw file, so extraction failing must never fail the upload itself. Branches on
    kind: a statement extracts a *list* of rows (S4), everything else a single receipt
    (S2/S3)."""
    try:
        ai_enabled = await cloud_enabled(profile, conn)

        if kind == "statement":
            extracted_json = await _extract_statement_json(
                file_path, mime_type, ai_enabled, profile, conn
            )
        else:
            extracted_json = await _extract_receipt_json(
                file_path, mime_type, ai_enabled, profile, conn
            )

        await conn.execute(
            "UPDATE documents SET extracted_json = $1 WHERE id = $2",
            extracted_json,
            document_id,
        )
    except Exception as e:
        log.warning("Document extraction failed for document %d: %s", document_id, e)


async def _extract_receipt_json(
    file_path: Path,
    mime_type: str,
    cloud_enabled: bool,
    profile: Profile,
    conn: asyncpg.Connection,
) -> dict:
    result: ExtractedDocument = await extract(
        file_path, mime_type, cloud_enabled, ai_service, country=profile.country
    )

    merchant_id: int | None = None
    if result.merchant:
        matched = await find_matching_merchant(profile.id, result.merchant, conn)
        merchant_id = matched.id if matched else None

    category_id: int | None = None
    if merchant_id is not None:
        category_id = await _category_from_merchant_history(profile.id, merchant_id, conn)
    if category_id is None and result.category_hint:
        category_id = await _category_from_hint(profile.user_id, result.category_hint, conn)

    return {
        "tier": result.tier,
        "confidence": result.confidence,
        "merchant": result.merchant,
        "merchant_id": merchant_id,
        "date": result.date.isoformat() if result.date else None,
        "total": float(result.total) if result.total is not None else None,
        "line_items": result.line_items,
        "category_hint": result.category_hint,
        "category_id": category_id,
        # E4: currency the document claims, and whether that contradicts the profile it
        # is being filed into. A profile is a sealed single-currency world, so an INR
        # receipt saved under a USD profile would corrupt the ledger by ~85x with no
        # visible symptom. We never convert — the review screen asks instead.
        # `currency_mismatch` is only true when the document says something *definite*
        # that disagrees; an unmarked receipt (the common case) is never a mismatch.
        "currency": result.currency,
        "currency_mismatch": (result.currency is not None and result.currency != profile.currency),
        "profile_currency": profile.currency,
    }


async def _extract_statement_json(
    file_path: Path,
    mime_type: str,
    cloud_enabled: bool,
    profile: Profile,
    conn: asyncpg.Connection,
) -> dict:
    result = await extract_statement(
        file_path, mime_type, cloud_enabled, ai_service, country=profile.country
    )

    # Resolve each row's category hint to a real category_id once here (cached by hint
    # so a statement full of "STARBUCKS" rows does one lookup, not N).
    hint_cache: dict[str, int | None] = {}
    rows_out: list[dict] = []
    for r in result.transactions:
        category_id: int | None = None
        if r.category_hint:
            if r.category_hint not in hint_cache:
                hint_cache[r.category_hint] = await _category_from_hint(
                    profile.user_id, r.category_hint, conn
                )
            category_id = hint_cache[r.category_hint]
        rows_out.append(
            {
                "date": r.date.isoformat() if r.date else None,
                "description": r.description,
                "amount": float(r.amount),
                "transaction_type": r.transaction_type,
                "category_hint": r.category_hint,
                "category_id": category_id,
            }
        )

    return {"kind": "statement", "tier": result.tier, "transactions": rows_out}


@router.get("/", response_model=list[LibraryDocumentResponse])
async def list_documents(
    status_filter: Literal["pending", "processed", "all"] = Query(
        default="pending", alias="status"
    ),
    kind: DocumentKind | None = None,
    q: str | None = Query(default=None, max_length=MAX_FILENAME_LENGTH),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """The review queue *and* (X1) the document library, depending on `status`.

    Defaults to `pending` so every pre-X1 caller — `PendingReceipts.tsx`, the mobile
    scan flow — keeps its exact previous behaviour without passing anything new. The
    library asks for `all`.

    Before X1 there was no way to reach a document once it had been reviewed: this
    endpoint hard-filtered `status = 'pending'` and nothing else listed the table.
    """
    # Filters are appended positionally so the parameter numbering stays in step with
    # the values list — raw parameterized SQL per rules/database.md, never f-string
    # interpolation of a user value.
    conditions = ["profile_id = $1"]
    values: list[object] = [profile.id]

    if status_filter == "pending":
        conditions.append("status = 'pending'")
    elif status_filter == "processed":
        conditions.append("status <> 'pending'")

    if kind is not None:
        values.append(kind)
        conditions.append(f"kind = ${len(values)}")
    if q:
        values.append(f"%{q}%")
        conditions.append(f"original_filename ILIKE ${len(values)}")
    if start_date is not None:
        values.append(start_date)
        conditions.append(f"uploaded_at >= ${len(values)}")
    if end_date is not None:
        values.append(end_date)
        conditions.append(f"uploaded_at <= ${len(values)}")

    rows = await conn.fetch(
        f"""SELECT d.id, d.kind, d.mime_type, d.status, d.uploaded_at,
                   d.extracted_json, d.original_filename,
                   (SELECT t.id FROM transactions t
                     WHERE t.document_id = d.id
                     ORDER BY t.id LIMIT 1) AS linked_transaction_id,
                   (SELECT COUNT(*) FROM transactions t
                     WHERE t.document_id = d.id) AS linked_transaction_count
            FROM documents d
            WHERE {" AND ".join(conditions)}
            ORDER BY d.uploaded_at DESC""",
        *values,
    )
    return [
        LibraryDocumentResponse(
            id=r["id"],
            kind=r["kind"],
            mime_type=r["mime_type"],
            status=r["status"],
            uploaded_at=r["uploaded_at"].isoformat(),
            extracted_json=r["extracted_json"],
            original_filename=r["original_filename"],
            linked_transaction_id=r["linked_transaction_id"],
            linked_transaction_count=r["linked_transaction_count"],
        )
        for r in rows
    ]


class HashCheckRequest(BaseModel):
    # A folder drop is capped at 500 files client-side (X2); cap here too so a hostile
    # or buggy client can't ask us to match an unbounded list in one round trip.
    sha256: list[str] = Field(default_factory=list, max_length=500)


class HashCheckResponse(BaseModel):
    already_uploaded: list[str]


@router.post("/check-hashes", response_model=HashCheckResponse)
async def check_hashes(
    request: HashCheckRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """X2: which of these files does this profile already have?

    Folder upload's defining behaviour is that re-dropping the same folder is a safe
    no-op — people re-scan a directory after adding two files to it, and creating 200
    duplicate documents in that case would make the feature actively dangerous. The
    client hashes locally and asks this before uploading a byte, so unchanged files are
    skipped rather than re-sent.

    Content-hashed, not name-matched: renaming `statement.pdf` to `statement (1).pdf`
    must not defeat it. Scoped to the profile — the same file in another country profile
    is a legitimately separate document.
    """
    if not request.sha256:
        return HashCheckResponse(already_uploaded=[])
    rows = await conn.fetch(
        """SELECT DISTINCT content_sha256 FROM documents
           WHERE profile_id = $1 AND content_sha256 = ANY($2::char(64)[])""",
        profile.id,
        request.sha256,
    )
    return HashCheckResponse(already_uploaded=[r["content_sha256"] for r in rows])


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    # W6: auto-detected when omitted — the frontend no longer sends this by default
    # (dropped the manual Receipt/Statement picker). Still accepted so the review
    # dialogs' "doesn't look right, switch kind" escape hatch can force one explicitly.
    kind: DocumentKind | None = Form(default=None),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    content_type = file.content_type or ""
    # X3: two tiers of acceptance. Understandable types go through extraction as before;
    # store-only types are kept and listed but never parsed, so a folder upload full of
    # letters and warranties doesn't produce a wall of red "Failed" rows.
    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    store_only = False
    if ext is None:
        ext = STORE_ONLY_CONTENT_TYPES.get(content_type)
        store_only = ext is not None
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only images, PDFs, or text/Word documents are accepted",
        )

    # Read one byte past the cap so an oversize file is caught without ever buffering
    # more than MAX_UPLOAD_SIZE_BYTES + 1 bytes in memory.
    content = await file.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB limit",
        )
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    filename = f"{uuid.uuid4().hex}{ext}"
    dest = _upload_dir(profile.user_id) / filename
    dest.write_bytes(content)
    relative_path = str(Path(settings.UPLOAD_DIR) / str(profile.user_id) / filename)

    if store_only:
        # X3: no extraction attempt at all for these — not a failed attempt, an
        # intentional non-attempt. The caller can still force a reading later via
        # POST /{id}/reclassify if a .txt really was a receipt.
        kind = "other"
    elif kind is None:
        # W6: classify from the same local text tier C always extracts anyway (zero
        # network, no extra cost beyond one redundant re-extraction inside whichever
        # of _extract_receipt_json/_extract_statement_json runs next — accepted
        # tradeoff over threading pre-extracted text through both extraction paths).
        # Best-effort: a classification failure (corrupt file, etc.) must not fail the
        # upload — the existing extraction step will hit and log the same error.
        try:
            # Off the event loop: this is the same blocking pdfplumber/Tesseract work
            # as the extraction step, and it runs on every single upload.
            raw_text, _ = await asyncio.to_thread(extract_raw_text, dest, content_type)
            # X3: a PDF with no recoverable text (image-only scan, or simply not a
            # financial document) is honestly "other" rather than a receipt we failed
            # at — the old default produced a pending row with every field blank and no
            # explanation of why.
            kind = guess_document_kind(raw_text) if raw_text.strip() else "other"
        except Exception as e:
            log.warning("Kind auto-detection failed, defaulting to receipt: %s", e)
            kind = "receipt"

    # X3: an `other` document is filed, not queued. Inserting it as 'pending' put
    # warranty letters and tax forms into the review queue alongside real receipts —
    # caught in live verification of X2, where a folder upload pushed "Pending
    # Documents" from 1 to 4 and one of them was a .txt that can never be reviewed.
    # 'filed' keeps it out of the pending list while still counting as processed
    # (`status <> 'pending'`) in the X1 library.
    initial_status = "filed" if kind == "other" else "pending"

    row = await conn.fetchrow(
        """INSERT INTO documents (profile_id, kind, file_path, mime_type, status,
                                  original_filename, content_sha256)
           VALUES ($1, $2, $3, $4, $7, $5, $6)
           RETURNING id, kind, mime_type, status, uploaded_at, original_filename""",
        profile.id,
        kind,
        relative_path,
        content_type,
        _display_filename(file.filename),
        # Hash the bytes we actually stored, so X2's "already uploaded?" check compares
        # content rather than a name the user can trivially change between drops.
        hashlib.sha256(content).hexdigest(),
        initial_status,
    )

    # X3: `other` is store-only by definition — running extraction against a letter or a
    # tax form would burn OCR time to produce a blank result and an unexplained pending
    # row. Skipping is the honest behaviour, not a shortcut.
    if kind != "other":
        await _extract_and_store(row["id"], dest, content_type, kind, profile, conn)

    return DocumentResponse(
        id=row["id"],
        kind=row["kind"],
        mime_type=row["mime_type"],
        status=row["status"],
        uploaded_at=row["uploaded_at"].isoformat(),
        original_filename=row["original_filename"],
    )


@router.post("/{document_id}/reclassify", response_model=PendingDocumentResponse)
async def reclassify_document(
    document_id: int,
    kind: DocumentKind,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """W6's misclassification escape hatch — auto-detect guesses wrong occasionally, so
    the review dialogs offer "doesn't look right, switch to Receipt/Statement" instead
    of forcing a re-upload. Re-runs extraction against the already-stored file under
    the user-forced kind and overwrites `extracted_json`."""
    row = await conn.fetchrow(
        """SELECT file_path, mime_type FROM documents
           WHERE id = $1 AND profile_id = $2 AND status = 'pending'""",
        document_id,
        profile.id,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or already reviewed",
        )

    file_path = Path(row["file_path"])
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file missing")

    await conn.execute("UPDATE documents SET kind = $1 WHERE id = $2", kind, document_id)
    await _extract_and_store(document_id, file_path, row["mime_type"], kind, profile, conn)

    updated = await conn.fetchrow(
        """SELECT id, kind, mime_type, status, uploaded_at, extracted_json, original_filename
           FROM documents WHERE id = $1""",
        document_id,
    )
    return PendingDocumentResponse(
        id=updated["id"],
        kind=updated["kind"],
        mime_type=updated["mime_type"],
        status=updated["status"],
        uploaded_at=updated["uploaded_at"].isoformat(),
        extracted_json=updated["extracted_json"],
        original_filename=updated["original_filename"],
    )


@router.get("/{document_id}")
async def get_document(
    document_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        "SELECT file_path, mime_type FROM documents WHERE id = $1 AND profile_id = $2",
        document_id,
        profile.id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    path = Path(row["file_path"])
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return FileResponse(path, media_type=row["mime_type"])


@router.post("/{document_id}/review", response_model=DocumentReviewResponse)
async def review_document(
    document_id: int,
    payload: DocumentReviewRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Nothing before this point has created a transaction — extraction only ever
    pre-filled a form. This is the one place a document turns into money-moving data,
    gated by the same D3 dedup check every other import path runs through."""
    doc_row = await conn.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND profile_id = $2 AND status = 'pending'",
        document_id,
        profile.id,
    )
    if doc_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or already reviewed"
        )

    await check_category_owned(payload.category_id, profile, conn)
    await check_related_ids_owned(
        account_id=payload.account_id, merchant_id=payload.merchant_id, profile=profile, conn=conn
    )

    merchant_name: str | None = None
    if payload.merchant_id is not None:
        merchant_row = await conn.fetchrow(
            "SELECT name FROM merchants WHERE id = $1 AND profile_id = $2",
            payload.merchant_id,
            profile.id,
        )
        merchant_name = merchant_row["name"] if merchant_row else None

    if payload.skip_dedup:
        normalized_desc = normalize_name(merchant_name or payload.description)
        import_hash = compute_import_hash(
            profile.id,
            payload.account_id,
            payload.date.date(),
            Decimal(str(payload.amount)),
            normalized_desc,
        )
    else:
        result = await find_duplicates(
            DedupCandidate(
                profile_id=profile.id,
                account_id=payload.account_id,
                date=payload.date.date(),
                amount=Decimal(str(payload.amount)),
                description=payload.description,
                merchant_name=merchant_name,
            ),
            conn,
        )
        if result.status == "exact":
            # Already imported — nothing new to review. Mark this document handled so
            # it doesn't linger in the queue forever with no possible action left.
            await conn.execute(
                "UPDATE documents SET status = 'reviewed' WHERE id = $1", document_id
            )
            return DocumentReviewResponse(
                status="exact_duplicate", transaction_id=result.exact_transaction_id
            )
        if result.status == "fuzzy":
            return DocumentReviewResponse(
                status="fuzzy_duplicate",
                fuzzy_matches=[
                    FuzzyMatchInfo(
                        transaction_id=m.transaction_id,
                        date=m.date,
                        amount=float(m.amount),
                        description=m.description,
                        merchant_name=m.merchant_name,
                        similarity=m.similarity,
                    )
                    for m in result.fuzzy_matches
                ],
            )
        import_hash = result.import_hash

    tx_row = await conn.fetchrow(
        """INSERT INTO transactions
             (amount, description, transaction_type, account_id, category_id,
              merchant_id, profile_id, date, notes, source, import_hash, document_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'document_scan', $10, $11)
           RETURNING id""",
        payload.amount,
        payload.description,
        payload.transaction_type,
        payload.account_id,
        payload.category_id,
        payload.merchant_id,
        profile.id,
        payload.date,
        payload.notes,
        import_hash,
        document_id,
    )
    await conn.execute("UPDATE documents SET status = 'reviewed' WHERE id = $1", document_id)

    return DocumentReviewResponse(status="created", transaction_id=tx_row["id"])


class BulkReviewRequest(BaseModel):
    document_ids: list[int] = Field(default_factory=list, max_length=200)
    account_id: int


class BulkReviewResponse(BaseModel):
    created: int
    duplicates: int
    # Documents that could not be auto-approved and still need a human. Returned as ids
    # so the UI can say how many are left rather than implying the whole batch is done.
    needs_review: list[int]


@router.post("/bulk-review", response_model=BulkReviewResponse)
async def bulk_review_documents(
    request: BulkReviewRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """X4: approve several high-confidence receipts as extracted, in one action.

    X2 made it possible to create 40 pending documents in one drop, at which point
    approving them one dialog at a time stops being reasonable. This is the bulk path —
    but **bulk never means unchecked**:

    - Every document still goes through the same D3 dedup gate as the single-document
      review. An exact duplicate is recorded as such and creates nothing.
    - Anything without a confident amount *and* date is refused and left pending
      (`needs_review`), because the whole point of the confidence signal is that those
      need a human. A bulk action that silently invented values would be worse than no
      bulk action.
    - Statements are refused outright: they expand into many rows with per-row dedup
      decisions, which is the statement review screen's job, not this one.
    """
    await check_related_ids_owned(account_id=request.account_id, profile=profile, conn=conn)
    if not request.document_ids:
        return BulkReviewResponse(created=0, duplicates=0, needs_review=[])

    rows = await conn.fetch(
        """SELECT id, kind, extracted_json FROM documents
           WHERE id = ANY($1::int[]) AND profile_id = $2 AND status = 'pending'""",
        request.document_ids,
        profile.id,
    )

    created = 0
    duplicates = 0
    needs_review: list[int] = []

    for row in rows:
        ex = row["extracted_json"] or {}
        total = ex.get("total")
        raw_date = ex.get("date")
        # Refuse anything the extractor wasn't confident about, or that is missing the
        # two fields a transaction cannot be invented without.
        if (
            row["kind"] == "statement"
            or ex.get("confidence") == "low"
            or total is None
            or not raw_date
        ):
            needs_review.append(row["id"])
            continue
        try:
            amount = Decimal(str(total))
            tx_date = datetime.fromisoformat(str(raw_date))
        except (InvalidOperation, ValueError):
            needs_review.append(row["id"])
            continue
        if amount <= 0 or amount > MAX_MONEY_AMOUNT:
            needs_review.append(row["id"])
            continue

        merchant_name = ex.get("merchant") or "Scanned receipt"
        dedup = await find_duplicates(
            DedupCandidate(
                profile_id=profile.id,
                account_id=request.account_id,
                date=tx_date.date(),
                amount=amount,
                description=merchant_name,
                merchant_name=ex.get("merchant"),
            ),
            conn,
        )
        if dedup.status == "exact":
            await conn.execute("UPDATE documents SET status = 'reviewed' WHERE id = $1", row["id"])
            duplicates += 1
            continue
        if dedup.status == "fuzzy":
            # A possible duplicate is exactly the case a human should look at.
            needs_review.append(row["id"])
            continue

        await conn.execute(
            """INSERT INTO transactions
                 (amount, description, transaction_type, account_id, category_id,
                  merchant_id, profile_id, date, source, import_hash, document_id)
               VALUES ($1, $2, 'expense', $3, $4, $5, $6, $7, 'document_scan', $8, $9)""",
            amount,
            merchant_name,
            request.account_id,
            ex.get("category_id"),
            ex.get("merchant_id"),
            profile.id,
            tx_date,
            dedup.import_hash,
            row["id"],
        )
        await conn.execute("UPDATE documents SET status = 'reviewed' WHERE id = $1", row["id"])
        created += 1

    return BulkReviewResponse(created=created, duplicates=duplicates, needs_review=needs_review)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Reject/remove — the document's file and row are gone; any transaction already
    created from it (via /review) keeps existing, just loses its paperclip link
    (`document_id` FK is ON DELETE SET NULL, never cascades to the transaction)."""
    row = await conn.fetchrow(
        "SELECT file_path FROM documents WHERE id = $1 AND profile_id = $2",
        document_id,
        profile.id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await conn.execute("DELETE FROM documents WHERE id = $1", document_id)
    Path(row["file_path"]).unlink(missing_ok=True)


# --- Statement review + import (S4) --------------------------------------------------


async def _load_statement_document(
    document_id: int, profile: Profile, conn: asyncpg.Connection
) -> dict:
    row = await conn.fetchrow(
        """SELECT extracted_json FROM documents
           WHERE id = $1 AND profile_id = $2 AND status = 'pending' AND kind = 'statement'""",
        document_id,
        profile.id,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Statement not found or already reviewed",
        )
    extracted = row["extracted_json"] or {}
    if extracted.get("kind") != "statement":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This document isn't a parsed statement",
        )
    return extracted


@router.get("/{document_id}/statement", response_model=StatementReviewResponse)
async def get_statement_rows(
    document_id: int,
    account_id: int,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """The extracted transaction rows, each tagged with its dedup verdict against the
    profile's existing transactions for the chosen account — so the review table can
    pre-uncheck exact duplicates and flag fuzzy ones. Dedup is account-scoped, so it's
    recomputed whenever the user changes the target account."""
    await check_related_ids_owned(account_id=account_id, profile=profile, conn=conn)
    extracted = await _load_statement_document(document_id, profile, conn)

    rows: list[StatementRowStatus] = []
    for i, r in enumerate(extracted.get("transactions", [])):
        row_date = datetime.fromisoformat(r["date"]) if r.get("date") else datetime.now()
        result = await find_duplicates(
            DedupCandidate(
                profile_id=profile.id,
                account_id=account_id,
                date=row_date.date(),
                amount=Decimal(str(r["amount"])),
                description=r["description"],
                # Mirror the import's hashing exactly (it derives the merchant the same
                # way) so an exact match here matches what import would compute — a
                # read-only parse, no merchant row created.
                merchant_name=extract_merchant_from_description(r["description"]),
            ),
            conn,
        )
        rows.append(
            StatementRowStatus(
                row_index=i,
                date=r.get("date"),
                description=r["description"],
                amount=r["amount"],
                transaction_type=r.get("transaction_type", "expense"),
                category_id=r.get("category_id"),
                category_hint=r.get("category_hint"),
                dedup_status=result.status,
            )
        )

    return StatementReviewResponse(tier=extracted.get("tier"), rows=rows)


@router.post("/{document_id}/statement/import", response_model=StatementImportResponse)
async def import_statement(
    document_id: int,
    payload: StatementImportRequest,
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Bulk-create the rows the user kept, each through the D3 dedup gate (an exact dupe
    that slipped through is still skipped server-side — the UI's unchecking is a
    convenience, not the safety boundary). All rows get source='document_scan' and the
    document_id paperclip; the document is marked reviewed once done."""
    await _load_statement_document(document_id, profile, conn)
    await check_related_ids_owned(account_id=payload.account_id, profile=profile, conn=conn)

    valid_category_ids = await get_valid_category_ids(profile.user_id, conn)

    imported = 0
    skipped = 0
    async with conn.transaction():
        for r in payload.rows:
            tx_date = r.date.replace(tzinfo=None) if r.date.tzinfo else r.date
            # A foreign/stale category id is neutralized rather than aborting the
            # whole batch — same soft-fallback style as merchant resolution below.
            row_category_id = r.category_id if r.category_id in valid_category_ids else None

            merchant_name = extract_merchant_from_description(r.description)
            merchant_id: int | None = None
            if merchant_name:
                merchant = await find_or_create_merchant(profile.id, merchant_name, conn)
                merchant_id = merchant.id if merchant else None

            if r.skip_dedup:
                normalized_desc = normalize_name(merchant_name or r.description)
                import_hash = compute_import_hash(
                    profile.id,
                    payload.account_id,
                    tx_date.date(),
                    Decimal(str(r.amount)),
                    normalized_desc,
                )
            else:
                result = await find_duplicates(
                    DedupCandidate(
                        profile_id=profile.id,
                        account_id=payload.account_id,
                        date=tx_date.date(),
                        amount=Decimal(str(r.amount)),
                        description=r.description,
                        merchant_name=merchant_name,
                    ),
                    conn,
                )
                # Exact or fuzzy without an explicit keep-both -> skip (server-side guard).
                if result.status != "none":
                    skipped += 1
                    continue
                import_hash = result.import_hash

            # E2: a credit row is only income if it has no plausible original purchase.
            # If it reverses a recent same-merchant expense it's a refund, and is stored
            # as a *negative expense* so it nets against that purchase's category rather
            # than inflating income. Falls back to income when nothing matches — the
            # same "decline to guess" rule E4 uses for currency.
            amount = r.amount
            ttype = r.transaction_type
            refund_of = None
            if ttype == "income":
                original = await find_refund_original(
                    profile.id, r.description, Decimal(str(r.amount)), tx_date.date(), conn
                )
                if original is not None:
                    ttype = "expense"
                    amount = -Decimal(str(r.amount))
                    refund_of = original["id"]
                    # Inherit the original's category — a refund belongs to whatever the
                    # purchase belonged to, and the statement line rarely says.
                    if row_category_id is None:
                        row_category_id = original["category_id"]

            await conn.execute(
                """INSERT INTO transactions
                     (amount, description, transaction_type, account_id, category_id,
                      merchant_id, profile_id, date, source, import_hash, document_id,
                      refund_of_transaction_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'document_scan', $9, $10, $11)""",
                amount,
                r.description,
                ttype,
                payload.account_id,
                row_category_id,
                merchant_id,
                profile.id,
                tx_date,
                import_hash,
                document_id,
                refund_of,
            )
            imported += 1

        await conn.execute("UPDATE documents SET status = 'reviewed' WHERE id = $1", document_id)

    return StatementImportResponse(imported=imported, skipped=skipped)
