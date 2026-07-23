"""Dismissed recurring groups — I2 "not a subscription" dismiss.

A recurring group (backend/services/insights/recurring.py's `group_key`: either
`merchant:<id>` or `desc:<normalized description>` for merchant-less groups like
income) that the user has explicitly marked "not a subscription" — excluded from
`GET /api/insights/recurring` going forward, per profile.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-22
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
    """CREATE TABLE dismissed_recurring_groups (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        group_key VARCHAR NOT NULL,
        dismissed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_dismissed_recurring_profile_group UNIQUE (profile_id, group_key)
    )""",
    "CREATE INDEX ix_dismissed_recurring_profile_id ON dismissed_recurring_groups (profile_id)",
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE IF EXISTS dismissed_recurring_groups",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
