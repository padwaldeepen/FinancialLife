"""add parent_id and is_system to categories

Revision ID: 0f6daffb3ff0
Revises: f4a3a875e97d
Create Date: 2026-06-29 02:53:34.278041

"""

import sqlalchemy as sa
from alembic import op

revision = "0f6daffb3ff0"
down_revision = "f4a3a875e97d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("is_system", sa.Boolean(), nullable=True))
    op.add_column("categories", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "categories", "categories", ["parent_id"], ["id"])

    op.execute("UPDATE categories SET is_system = FALSE WHERE is_system IS NULL")

    op.alter_column("categories", "is_system", existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    op.drop_constraint(None, "categories", type_="foreignkey")
    op.drop_column("categories", "parent_id")
    op.drop_column("categories", "is_system")
