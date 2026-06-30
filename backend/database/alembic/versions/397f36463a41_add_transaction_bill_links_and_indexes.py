"""add transaction_bill_links table and composite indexes

Revision ID: 397f36463a41
Revises: af5767b466ab
Create Date: 2026-06-30 05:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "397f36463a41"
down_revision = "af5767b466ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transaction_bill_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("bill_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("is_auto_linked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bill_id"], ["bills.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_transaction_bill_links_id"), "transaction_bill_links", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_transaction_bill_links_transaction_id"),
        "transaction_bill_links",
        ["transaction_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_bill_links_bill_id"),
        "transaction_bill_links",
        ["bill_id"],
        unique=False,
    )

    op.create_index("ix_transactions_user_date", "transactions", ["user_id", "date"], unique=False)
    op.create_index(
        "ix_transactions_user_type", "transactions", ["user_id", "transaction_type"], unique=False
    )
    op.create_index("ix_transactions_account", "transactions", ["account_id"], unique=False)
    op.create_index("ix_transactions_category", "transactions", ["category_id"], unique=False)
    op.create_index("ix_transactions_merchant", "transactions", ["merchant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_transactions_merchant", table_name="transactions")
    op.drop_index("ix_transactions_category", table_name="transactions")
    op.drop_index("ix_transactions_account", table_name="transactions")
    op.drop_index("ix_transactions_user_type", table_name="transactions")
    op.drop_index("ix_transactions_user_date", table_name="transactions")

    op.drop_index(op.f("ix_transaction_bill_links_bill_id"), table_name="transaction_bill_links")
    op.drop_index(
        op.f("ix_transaction_bill_links_transaction_id"), table_name="transaction_bill_links"
    )
    op.drop_index(op.f("ix_transaction_bill_links_id"), table_name="transaction_bill_links")
    op.drop_table("transaction_bill_links")
