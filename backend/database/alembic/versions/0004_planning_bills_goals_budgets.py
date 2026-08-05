"""Planning — bills, goals, budgets.

Layer 4 of 5. The forward-looking layer: what's due, what you're saving toward, and
what you're allowed to spend. All profile-scoped; each references categories (and
bills also references merchants and accounts) from earlier layers.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-17
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
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
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS budgets",
    "DROP TABLE IF EXISTS goals",
    "DROP TABLE IF EXISTS bills",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
