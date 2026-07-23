"""Dismissed insight types — I6 advice card dismiss.

Dismissing an advice card suppresses that card's `type` (e.g. "goal_pacing",
"top_subscriptions") for the profile going forward, not just the one instance —
same generalization as I2's "not a subscription" pattern, per design-system.md
§4's transparent-AI dismiss requirement.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-22
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

UPGRADE_STATEMENTS = [
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
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
