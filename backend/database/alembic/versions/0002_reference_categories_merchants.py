"""Reference data — categories and merchants.

Layer 2 of 5. The labels and payees that transactions point at.

- `categories` are user-level taxonomy shared across a person's profiles (e.g.
  "Kids' School" applies in every country world) — deliberately keyed to user_id,
  NOT profile_id. `is_system` rows have user_id NULL (global defaults).
- `merchants` are profile-scoped (a payee only means something inside one country
  world), with alias/dedup support.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-17
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
    """CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        color VARCHAR NOT NULL DEFAULT '#6B7280',
        icon VARCHAR,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX ix_categories_user_id ON categories (user_id)",
    "CREATE INDEX ix_categories_parent_id ON categories (parent_id)",
    """CREATE TABLE merchants (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        normalized_name VARCHAR NOT NULL,
        aliases JSONB,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX ix_merchants_profile_id ON merchants (profile_id)",
    "CREATE INDEX ix_merchants_normalized_name ON merchants (normalized_name)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS merchants",
    "DROP TABLE IF EXISTS categories",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
