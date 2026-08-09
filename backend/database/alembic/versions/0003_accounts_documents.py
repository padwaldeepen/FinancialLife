"""Money containers — accounts and documents.

Layer 3 of 5. Where money actually sits, and what you feed in.

- `accounts` are the real places money lives inside a country world (checking,
  savings, credit card, cash).
- `documents` are uploaded receipts/statements plus the JSON extracted from them;
  created here because transactions (layer 5) reference document_id.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-17
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
    """CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
    )""",
    "CREATE INDEX ix_accounts_profile_id ON accounts (profile_id)",
    """CREATE TABLE documents (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        kind VARCHAR NOT NULL,
        file_path VARCHAR NOT NULL,
        mime_type VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        extracted_json JSONB,
        -- X1: display-only name the file arrived with. NEVER part of a filesystem path -
        -- `file_path` above is the only path, and it is always the uuid we generate.
        original_filename VARCHAR,
        -- X2: hash of the stored bytes, so re-dropping the same folder is a safe no-op
        -- rather than creating a second copy of everything.
        content_sha256 CHAR(64),
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX ix_documents_profile_id ON documents (profile_id)",
    # Deliberately NOT unique: the same file legitimately exists in two country
    # profiles, and the question X2 asks is "have I seen this in *this* profile".
    "CREATE INDEX ix_documents_profile_sha256 ON documents (profile_id, content_sha256)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS documents",
    "DROP TABLE IF EXISTS accounts",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
