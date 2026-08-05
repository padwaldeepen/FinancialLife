"""Activity — transactions and UI dismissals.

Layer 5 of 5. The hub and the running state.

- `transactions` is the centre of the model: every money movement, pointing back at
  account, category, merchant, bill, goal, and document (all nullable except the
  account it happened in). A payment is tied to a bill by `transactions.bill_id`
  alone — "already paid this period" is derived from that plus the transaction date.
- `dismissed_recurring_groups` / `dismissed_insight_types` are per-profile "stop
  suggesting this" memory for recurring detection (I2) and advice cards (I6).

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-22
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
    """CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        amount NUMERIC(12, 2) NOT NULL,
        description VARCHAR NOT NULL,
        transaction_type VARCHAR NOT NULL,
        -- RESTRICT (default): deleting an account with transactions fails rather
        -- than silently destroying financial history.
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
        bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
        goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        is_pending BOOLEAN NOT NULL DEFAULT FALSE,
        is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
        date TIMESTAMP NOT NULL,
        notes TEXT,
        ai_categorized BOOLEAN NOT NULL DEFAULT FALSE,
        source VARCHAR NOT NULL DEFAULT 'manual',
        import_hash VARCHAR,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
    )""",
    "CREATE INDEX ix_transactions_profile_date ON transactions (profile_id, date)",
    "CREATE INDEX ix_transactions_profile_type ON transactions (profile_id, transaction_type)",
    "CREATE INDEX ix_transactions_account ON transactions (account_id)",
    "CREATE INDEX ix_transactions_category ON transactions (category_id)",
    "CREATE INDEX ix_transactions_merchant ON transactions (merchant_id)",
    "CREATE INDEX ix_transactions_bill_id ON transactions (bill_id)",
    "CREATE INDEX ix_transactions_import_hash ON transactions (import_hash)",
    # A recurring group (recurring.py's `group_key`) the user marked "not a
    # subscription" — excluded from GET /api/insights/recurring, per profile (I2).
    """CREATE TABLE dismissed_recurring_groups (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        group_key VARCHAR NOT NULL,
        dismissed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_dismissed_recurring_profile_group UNIQUE (profile_id, group_key)
    )""",
    "CREATE INDEX ix_dismissed_recurring_profile_id ON dismissed_recurring_groups (profile_id)",
    # An advice-card `type` (e.g. "goal_pacing") the user dismissed — suppressed for
    # the profile going forward, not just the one instance (I6).
    """CREATE TABLE dismissed_insight_types (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        insight_type VARCHAR NOT NULL,
        dismissed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_dismissed_insight_profile_type UNIQUE (profile_id, insight_type)
    )""",
    "CREATE INDEX ix_dismissed_insight_profile_id ON dismissed_insight_types (profile_id)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS dismissed_insight_types",
    "DROP TABLE IF EXISTS dismissed_recurring_groups",
    "DROP TABLE IF EXISTS transactions",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
