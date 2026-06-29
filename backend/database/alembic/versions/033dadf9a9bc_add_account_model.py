"""add account model

Revision ID: 033dadf9a9bc
Revises: 07bd2b06c9d8
Create Date: 2026-06-29 02:28:58.986051

"""

import sqlalchemy as sa
from alembic import op

revision = "033dadf9a9bc"
down_revision = "07bd2b06c9d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_id"), "accounts", ["id"], unique=False)

    op.add_column("transactions", sa.Column("account_id", sa.Integer(), nullable=True))

    bind = op.get_bind()
    users = bind.execute(sa.text("SELECT id FROM users")).fetchall()

    for (user_id,) in users:
        result = bind.execute(
            sa.text(
                "INSERT INTO accounts (user_id, name, type, currency, is_active, sort_order) "
                "VALUES (:uid, 'Cash', 'checking', 'USD', true, 0) RETURNING id"
            ),
            {"uid": user_id},
        )
        default_account_id = result.scalar()

        bind.execute(
            sa.text(
                "UPDATE transactions SET account_id = :aid WHERE user_id = :uid AND account_id IS NULL"
            ),
            {"aid": default_account_id, "uid": user_id},
        )

    op.alter_column("transactions", "account_id", nullable=False)
    op.create_foreign_key(None, "transactions", "accounts", ["account_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint(None, "transactions", type_="foreignkey")
    op.drop_column("transactions", "account_id")
    op.drop_index(op.f("ix_accounts_id"), table_name="accounts")
    op.drop_table("accounts")
