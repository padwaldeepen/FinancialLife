"""Foundation — users and their sealed country profiles.

Layer 1 of 5. The identity root of the whole schema: a login (`users`) owns 1–3
`profiles`, each a single-currency country world (US/USD, IN/INR, CA/CAD) that is
never merged with another in any query, report, or export
(architecture-and-goals.md). Every financial table downstream hangs off `profile_id`.

Split note: the schema is delivered as five logical migrations (foundation →
reference → containers → planning → activity) rather than one squashed file, so the
model reads as a dependency-ordered story. No real data exists yet, so this ordering
is authoritative, not historical.

Each DDL statement is its own op.execute() call — asyncpg's prepared-statement
protocol allows exactly one command per execute().

Revision ID: 0001
Revises:
Create Date: 2026-07-17
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
    """CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR NOT NULL UNIQUE,
        username VARCHAR NOT NULL UNIQUE,
        hashed_password VARCHAR NOT NULL,
        full_name VARCHAR,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        ai_cloud_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
    )""",
    "CREATE INDEX ix_users_email ON users (email)",
    "CREATE INDEX ix_users_username ON users (username)",
    # Sealed, single-currency country worlds. Never merged with each other in any
    # query, report, or export (architecture-and-goals.md).
    """CREATE TABLE profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        country VARCHAR(2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_profile_user_country UNIQUE (user_id, country)
    )""",
    "CREATE INDEX ix_profiles_user_id ON profiles (user_id)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS profiles",
    "DROP TABLE IF EXISTS users",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
