"""Document storage — backlog.md S1 — plus S2's extraction wiring and S3's review
screen. S3: nothing auto-commits — extraction only ever pre-fills a form; the user
reviews/edits it, and only `POST /{id}/review` actually creates a transaction, running
the same D3 dedup gate (`services/ingest/dedup.py`) every other import path uses.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.config import settings
from core.logging import get_logger
from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile
from routers.transactions import FuzzyMatchInfo
from services.ai.ai_service import AIService
from services.category_service import get_valid_category_ids
from services.ingest.dedup import DedupCandidate, compute_import_hash, find_duplicates
from services.ingest.document_extract import (
    ExtractedDocument,
    extract,
    extract_raw_text,
    extract_statement,
    guess_document_kind,
)
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
# filename — the filename itself is discarded entirely (architecture-and-goals.md:
# "path never client-controlled").
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}

DocumentKind = Literal["receipt", "bill", "statement", "other"]


class DocumentResponse(BaseModel):
    id: int
    kind: str
    mime_type: str
    status: str
    uploaded_at: str


class PendingDocumentResponse(DocumentResponse):
    extracted_json: dict | None


class DocumentReviewRequest(BaseModel):
    amount: float = Field(gt=0)
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
    amount: float
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
    amount: float = Field(gt=0)
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


async def _category_from_hint(
    user_id: int, hint: str, conn: asyncpg.Connection
) -> int | None:
    row = await conn.fetchrow(
        """SELECT id FROM categories
           WHERE (user_id = $1 OR is_system) AND lower(name) = lower($2)
           LIMIT 1""",
        user_id,
        hint,
    )
    return row["id"] if row else None


async def _user_cloud_enabled(profile: Profile, conn: asyncpg.Connection) -> bool:
    user_row = await conn.fetchrow(
        "SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id
    )
    return bool(user_row["ai_cloud_enabled"]) if user_row else False


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
        cloud_enabled = await _user_cloud_enabled(profile, conn)

        if kind == "statement":
            extracted_json = await _extract_statement_json(
                file_path, mime_type, cloud_enabled, profile, conn
            )
        else:
            extracted_json = await _extract_receipt_json(
                file_path, mime_type, cloud_enabled, profile, conn
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


@router.get("/", response_model=list[PendingDocumentResponse])
async def list_pending_documents(
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    """The review queue (architecture-and-goals.md) — every uploaded document still
    awaiting a decision, extracted or not (extraction failing is not fatal to the
    upload; the review screen just starts from a blank form in that case)."""
    rows = await conn.fetch(
        """SELECT id, kind, mime_type, status, uploaded_at, extracted_json
           FROM documents WHERE profile_id = $1 AND status = 'pending'
           ORDER BY uploaded_at DESC""",
        profile.id,
    )
    return [
        PendingDocumentResponse(
            id=r["id"],
            kind=r["kind"],
            mime_type=r["mime_type"],
            status=r["status"],
            uploaded_at=r["uploaded_at"].isoformat(),
            extracted_json=r["extracted_json"],
        )
        for r in rows
    ]


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
    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, or PDF files are accepted",
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

    if kind is None:
        # W6: classify from the same local text tier C always extracts anyway (zero
        # network, no extra cost beyond one redundant re-extraction inside whichever
        # of _extract_receipt_json/_extract_statement_json runs next — accepted
        # tradeoff over threading pre-extracted text through both extraction paths).
        # Best-effort: a classification failure (corrupt file, etc.) must not fail the
        # upload — the existing extraction step will hit and log the same error.
        try:
            raw_text, _ = extract_raw_text(dest, content_type)
            kind = guess_document_kind(raw_text)
        except Exception as e:
            log.warning("Kind auto-detection failed, defaulting to receipt: %s", e)
            kind = "receipt"

    row = await conn.fetchrow(
        """INSERT INTO documents (profile_id, kind, file_path, mime_type, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id, kind, mime_type, status, uploaded_at""",
        profile.id,
        kind,
        relative_path,
        content_type,
    )

    await _extract_and_store(row["id"], dest, content_type, kind, profile, conn)

    return DocumentResponse(
        id=row["id"],
        kind=row["kind"],
        mime_type=row["mime_type"],
        status=row["status"],
        uploaded_at=row["uploaded_at"].isoformat(),
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
        "SELECT id, kind, mime_type, status, uploaded_at, extracted_json FROM documents WHERE id = $1",
        document_id,
    )
    return PendingDocumentResponse(
        id=updated["id"],
        kind=updated["kind"],
        mime_type=updated["mime_type"],
        status=updated["status"],
        uploaded_at=updated["uploaded_at"].isoformat(),
        extracted_json=updated["extracted_json"],
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

            await conn.execute(
                """INSERT INTO transactions
                     (amount, description, transaction_type, account_id, category_id,
                      merchant_id, profile_id, date, source, import_hash, document_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'document_scan', $9, $10)""",
                r.amount,
                r.description,
                r.transaction_type,
                payload.account_id,
                row_category_id,
                merchant_id,
                profile.id,
                tx_date,
                import_hash,
                document_id,
            )
            imported += 1

        await conn.execute(
            "UPDATE documents SET status = 'reviewed' WHERE id = $1", document_id
        )

    return StatementImportResponse(imported=imported, skipped=skipped)
