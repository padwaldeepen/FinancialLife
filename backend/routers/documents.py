"""Document storage — backlog.md S1. Receipt/bill/statement uploads: the `documents`
table has existed since D1; this wires the actual upload/serve endpoints and on-disk
storage. Extraction (S2) and the review/approve flow are separate, later tickets —
this ticket only gets a file from the client onto disk and back, safely.
"""

import uuid
from pathlib import Path
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.config import settings
from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile

router = APIRouter()

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


def _upload_dir(user_id: int) -> Path:
    d = Path(settings.UPLOAD_DIR) / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    kind: DocumentKind = Form(default="receipt"),
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

    row = await conn.fetchrow(
        """INSERT INTO documents (profile_id, kind, file_path, mime_type, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id, kind, mime_type, status, uploaded_at""",
        profile.id,
        kind,
        relative_path,
        content_type,
    )
    return DocumentResponse(
        id=row["id"],
        kind=row["kind"],
        mime_type=row["mime_type"],
        status=row["status"],
        uploaded_at=row["uploaded_at"].isoformat(),
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
