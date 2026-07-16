"""fix data integrity: numeric money, foreign keys, constraints

Revision ID: b1a2c3d4e5f6
Revises: fad09b2d9179
Create Date: 2026-07-16 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "b1a2c3d4e5f6"
down_revision = "fad09b2d9179"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Change Float → Numeric(12,2) for all money columns
    op.alter_column(
        "transactions",
        "amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "budgets",
        "amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "bills",
        "amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "bills",
        "amount_estimated",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=True,
    )
    op.alter_column(
        "goals",
        "target_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "goals",
        "current_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "goals",
        "monthly_contribution",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 2),
        existing_nullable=True,
    )

    # 2. Add ForeignKey constraints on bill_id and goal_id
    op.create_foreign_key(
        "fk_transactions_bill_id",
        "transactions",
        "bills",
        ["bill_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_transactions_goal_id",
        "transactions",
        "goals",
        ["goal_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 3. Add UniqueConstraint on TransactionBillLink
    op.create_unique_constraint(
        "uq_transaction_bill_link",
        "transaction_bill_links",
        ["transaction_id", "bill_id"],
    )

    # 4. Add UniqueConstraint on Budget (user_id, name)
    op.create_unique_constraint(
        "uq_budget_user_name",
        "budgets",
        ["user_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_budget_user_name", "budgets", type_="unique")
    op.drop_constraint("uq_transaction_bill_link", "transaction_bill_links", type_="unique")
    op.drop_constraint("fk_transactions_goal_id", "transactions", type_="foreignkey")
    op.drop_constraint("fk_transactions_bill_id", "transactions", type_="foreignkey")

    op.alter_column(
        "goals",
        "monthly_contribution",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=True,
    )
    op.alter_column(
        "goals",
        "current_amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "goals",
        "target_amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "bills",
        "amount_estimated",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=True,
    )
    op.alter_column(
        "bills",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "budgets",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "transactions",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Float(),
        existing_nullable=False,
    )
