"""The cloud-AI opt-in gate.

Tier 3 (Gemini) is the only external call this app ever makes, and it is allowed only
for users who have flipped `ai_cloud_enabled` on — off by default (CLAUDE.md, "AI tiers").
Every call site must check it.

That check used to be copy-pasted four times: two routers had private helpers with
identical bodies (`documents._user_cloud_enabled`, `transactions._cloud_enabled`) and
two inlined the query (`chat.py`, `insights.py`). Four copies of a privacy boundary is
four places to forget to update and one place to get it wrong, so it lives here now.
"""

import asyncpg

from database.models import Profile


async def cloud_enabled(profile: Profile, conn: asyncpg.Connection) -> bool:
    """True only if this profile's owner has explicitly opted into cloud AI.

    Fails closed: a missing user row returns False rather than raising, because the
    safe answer to "may I send this person's finances to Google" is always no.
    """
    row = await conn.fetchrow("SELECT ai_cloud_enabled FROM users WHERE id = $1", profile.user_id)
    return bool(row["ai_cloud_enabled"]) if row else False
