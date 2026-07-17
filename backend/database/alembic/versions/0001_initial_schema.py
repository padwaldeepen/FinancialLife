"""Initial schema — v2 country-profile model, raw SQL (no ORM).

One squashed migration replaces the entire pre-D1 history; there is no real data yet
(architecture-and-goals.md "Migration strategy"). From the first real transaction
onward, every schema change gets its own hand-written incremental revision.

Each DDL statement is its own op.execute() call — asyncpg's prepared-statement
protocol (used by SQLAlchemy's async engine, which Alembic's async runner relies on)
allows exactly one command per execute(), so a single multi-statement string fails
with "cannot insert multiple commands into a prepared statement".

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
    # Categories are user-level taxonomy shared across a person's profiles (e.g.
    # "Kids' School" applies in every country world) — the one table deliberately
    # NOT re-keyed to profile_id. is_system rows have user_id NULL.
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
    # documents is created before bills/transactions since transactions.document_id
    # references it.
    """CREATE TABLE documents (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        kind VARCHAR NOT NULL,
        file_path VARCHAR NOT NULL,
        mime_type VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        extracted_json JSONB,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX ix_documents_profile_id ON documents (profile_id)",
    """CREATE TABLE bills (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        amount_estimated NUMERIC(12, 2),
        frequency VARCHAR NOT NULL,
        due_day INTEGER NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
        -- RESTRICT (default): an account with bills attached can't be deleted out
        -- from under them — reassign or delete the bills first.
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_variable BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
    )""",
    "CREATE INDEX ix_bills_profile_id ON bills (profile_id)",
    """CREATE TABLE goals (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        target_amount NUMERIC(12, 2) NOT NULL,
        current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
        monthly_contribution NUMERIC(12, 2),
        type VARCHAR NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        deadline TIMESTAMP,
        icon VARCHAR,
        color VARCHAR,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
    )""",
    "CREATE INDEX ix_goals_profile_id ON goals (profile_id)",
    """CREATE TABLE budgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        period VARCHAR NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP,
        CONSTRAINT uq_budget_profile_name UNIQUE (profile_id, name)
    )""",
    "CREATE INDEX ix_budgets_profile_id ON budgets (profile_id)",
    "CREATE INDEX ix_budgets_category_id ON budgets (category_id)",
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
    "CREATE INDEX ix_transactions_import_hash ON transactions (import_hash)",
    """CREATE TABLE transaction_bill_links (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        is_auto_linked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_transaction_bill_link UNIQUE (transaction_id, bill_id)
    )""",
    "CREATE INDEX ix_tbl_transaction_id ON transaction_bill_links (transaction_id)",
    "CREATE INDEX ix_tbl_bill_id ON transaction_bill_links (bill_id)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS transaction_bill_links",
    "DROP TABLE IF EXISTS transactions",
    "DROP TABLE IF EXISTS budgets",
    "DROP TABLE IF EXISTS goals",
    "DROP TABLE IF EXISTS bills",
    "DROP TABLE IF EXISTS documents",
    "DROP TABLE IF EXISTS accounts",
    "DROP TABLE IF EXISTS merchants",
    "DROP TABLE IF EXISTS categories",
    "DROP TABLE IF EXISTS profiles",
    "DROP TABLE IF EXISTS users",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
