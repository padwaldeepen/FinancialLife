"""add merchant model

Revision ID: a1b2c3d4e5f6
Revises: 0f6daffb3ff0
Create Date: 2026-06-29 03:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "a1b2c3d4e5f6"
down_revision = "0f6daffb3ff0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("normalized_name", sa.String(), nullable=False),
        sa.Column("aliases", JSONB(), nullable=True),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_merchants_normalized_name", "merchants", ["normalized_name"])
    op.create_index("ix_merchants_user_id", "merchants", ["user_id"])

    op.execute("UPDATE transactions SET merchant_id = NULL WHERE merchant_id IS NOT NULL")

    op.create_foreign_key(
        "fk_transactions_merchant_id",
        "transactions",
        "merchants",
        ["merchant_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_merchant_id", "transactions", type_="foreignkey")
    op.drop_table("merchants")
