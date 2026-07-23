"""Rule-generated advice cards — backlog.md I6. Pure functions over already-computed
inputs (recurring charges from I1, trend insights from I3, budget/goal status fetched
by the router), no DB access — same split as the rest of services/insights/.

Every card is deterministic and template-worded; the router may ask the AI layer to
rephrase the message for warmth, but the message's numbers always originate here, in
`evidence` — the AI layer never invents them (design-system.md's "transparent AI").
"""

from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal
from typing import Literal

from .recurring import RecurringCharge
from .trends import Insight

BUDGET_DRIFT_THRESHOLD_PCT = 90.0
GOAL_PACING_BEHIND_PCT = 15.0
TOP_SUBSCRIPTIONS_SHOWN = 3
MAX_CARDS = 5

AdviceType = Literal[
    "anomaly",
    "rising_streak",
    "price_hike",
    "budget_drift",
    "goal_pacing",
    "top_subscriptions",
]


@dataclass
class AdviceCard:
    type: AdviceType
    message: str
    evidence: dict
    priority: int  # lower sorts first (more urgent)


@dataclass
class BudgetStatus:
    label: str
    amount: Decimal
    spent: Decimal


@dataclass
class GoalStatus:
    name: str
    target_amount: Decimal
    current_amount: Decimal
    monthly_contribution: Decimal | None
    deadline: date_type | None
    created_at: date_type


def _top_subscriptions_card(charges: list[RecurringCharge]) -> AdviceCard | None:
    subs = sorted(
        (c for c in charges if c.is_subscription),
        key=lambda c: c.monthly_equivalent,
        reverse=True,
    )
    if not subs:
        return None
    top = subs[:TOP_SUBSCRIPTIONS_SHOWN]
    names = ", ".join(f"{c.display_name} (${c.monthly_equivalent:.2f}/mo)" for c in top)
    total = sum((c.monthly_equivalent for c in subs), Decimal(0))
    return AdviceCard(
        type="top_subscriptions",
        message=f"Your top subscriptions: {names}.",
        evidence={
            "subscriptions": [
                {"name": c.display_name, "monthly_equivalent": float(c.monthly_equivalent)}
                for c in top
            ],
            "total_monthly": float(total),
        },
        priority=4,
    )


def _price_hike_cards(charges: list[RecurringCharge]) -> list[AdviceCard]:
    return [
        AdviceCard(
            type="price_hike",
            message=f"{c.display_name}'s price went up — now averaging ${c.avg_amount:.2f} per charge.",
            evidence={
                "name": c.display_name,
                "avg_amount": float(c.avg_amount),
                "cadence": c.cadence,
            },
            priority=1,
        )
        for c in charges
        if c.price_hike
    ]


def _budget_drift_cards(budgets: list[BudgetStatus]) -> list[AdviceCard]:
    cards = []
    for b in budgets:
        if b.amount <= 0:
            continue
        pct = float(b.spent / b.amount * 100)
        if pct < BUDGET_DRIFT_THRESHOLD_PCT:
            continue
        over = pct >= 100
        cards.append(
            AdviceCard(
                type="budget_drift",
                message=(
                    f"You've {'exceeded' if over else 'nearly reached'} your {b.label} budget "
                    f"({pct:.0f}% used)."
                ),
                evidence={
                    "name": b.label,
                    "spent": float(b.spent),
                    "budget": float(b.amount),
                    "pct_used": round(pct, 1),
                },
                priority=1 if over else 2,
            )
        )
    return cards


def _goal_pacing_cards(goals: list[GoalStatus], today: date_type) -> list[AdviceCard]:
    cards = []
    for g in goals:
        if g.target_amount <= 0:
            continue

        # Honesty rule: only claim a pacing verdict when there's a real timeline to
        # measure against — a deadline, or a monthly contribution rate. Neither
        # present means no basis for "behind" or "on track", so no card, not a guess.
        if g.deadline is not None:
            total_days = (g.deadline - g.created_at).days
            elapsed_days = (today - g.created_at).days
            if total_days <= 0 or elapsed_days <= 0:
                continue
            expected_pct = min(elapsed_days / total_days, 1.0) * 100
        elif g.monthly_contribution is not None and g.monthly_contribution > 0:
            months_elapsed = (today - g.created_at).days / 30.44
            if months_elapsed < 1:
                continue
            expected_amount = g.monthly_contribution * Decimal(str(round(months_elapsed, 2)))
            expected_pct = min(float(expected_amount / g.target_amount), 1.0) * 100
        else:
            continue

        actual_pct = float(g.current_amount / g.target_amount * 100)
        if expected_pct - actual_pct >= GOAL_PACING_BEHIND_PCT:
            cards.append(
                AdviceCard(
                    type="goal_pacing",
                    message=(
                        f"\"{g.name}\" is behind pace — {actual_pct:.0f}% saved vs an "
                        f"expected {expected_pct:.0f}%."
                    ),
                    evidence={
                        "name": g.name,
                        "current_amount": float(g.current_amount),
                        "target_amount": float(g.target_amount),
                        "actual_pct": round(actual_pct, 1),
                        "expected_pct": round(expected_pct, 1),
                    },
                    priority=3,
                )
            )
    return cards


def _trend_insight_cards(insights: list[Insight]) -> list[AdviceCard]:
    priority = {"anomaly": 1, "rising_streak": 3}
    return [
        AdviceCard(
            type=i.type,
            message=i.message,
            evidence=i.evidence,
            priority=priority[i.type],
        )
        for i in insights
    ]


def generate(
    charges: list[RecurringCharge],
    trend_insights: list[Insight],
    budgets: list[BudgetStatus],
    goals: list[GoalStatus],
    today: date_type,
) -> list[AdviceCard]:
    cards: list[AdviceCard] = []
    cards.extend(_trend_insight_cards(trend_insights))
    cards.extend(_price_hike_cards(charges))
    cards.extend(_budget_drift_cards(budgets))
    cards.extend(_goal_pacing_cards(goals, today))
    top_sub = _top_subscriptions_card(charges)
    if top_sub is not None:
        cards.append(top_sub)

    cards.sort(key=lambda c: c.priority)
    return cards[:MAX_CARDS]
