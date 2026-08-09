"""Activity — transactions and UI dismissals.

Layer 5 of 5. The hub and the running state.

- `transactions` is the centre of the model: every money movement, pointing back at
  account, category, merchant, bill, goal, document, and - for a transfer - a
  destination account (all nullable except the account it happened in). A payment is tied to a bill by `transactions.bill_id`
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
        -- E1: destination for a transfer between the user's own accounts. One row with
        -- a source (`account_id`) and a destination moves both balances; the aggregates
        -- already treat 'transfer' as neither income nor expense. NULL for every other
        -- transaction type.
        to_account_id INTEGER REFERENCES accounts(id),
        -- E2: the purchase this row reverses, when it is a refund. A refund is stored
        -- as an *expense with a negative amount*, never as income and never as a third
        -- transaction_type — that way category totals, budgets, balances, reports and
        -- safe-to-spend all net it correctly without a single aggregate query knowing
        -- refunds exist. SET NULL, not CASCADE: deleting the original purchase must not
        -- silently delete the refund of it, which is its own real money movement.
        refund_of_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
        -- E3: this row's amount is broken into `transaction_splits` parts. Denormalised
        -- so list rendering and the category aggregate can branch without a correlated
        -- subquery per row.
        is_split BOOLEAN NOT NULL DEFAULT FALSE,
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
    "CREATE INDEX ix_transactions_to_account ON transactions (to_account_id)",
    # Postgres does NOT auto-index foreign-key columns. Without this, the document
    # library resolves each document's linked transaction with a sequential scan, twice
    # per row — and a folder upload can add hundreds of documents in one gesture.
    """CREATE INDEX ix_transactions_document_id ON transactions (document_id)
       WHERE document_id IS NOT NULL""",
    """CREATE INDEX ix_transactions_refund_of ON transactions (refund_of_transaction_id)
       WHERE refund_of_transaction_id IS NOT NULL""",
    # E3: the parts of a split transaction. A side table rather than child rows in
    # `transactions`, deliberately: child rows would have required a `parent_id IS NULL`
    # guard on all 23 money aggregates in this codebase, where one miss double-counts
    # real money silently. Here `transactions` still holds exactly one row per money
    # movement, and only the queries that group by *category* need to know splits exist
    # (see services/category_spend.py). CASCADE makes "deleting the parent removes the
    # parts" a database guarantee rather than something application code remembers.
    """CREATE TABLE transaction_splits (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        amount NUMERIC(12, 2) NOT NULL,
        note VARCHAR
    )""",
    "CREATE INDEX ix_transaction_splits_transaction_id ON transaction_splits (transaction_id)",
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
    "DROP TABLE IF EXISTS transaction_splits",
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
