"""Trends & anomaly detection — backlog.md I3. Pure functions over a list of
categorized transactions, no DB access (same split as recurring.py: the router
fetches, this computes) — reused by I6's insight cards.

Honesty rule (design-system.md's "transparent AI" + this ticket's explicit accept
criterion): a category with fewer than 3 prior months of actual spending never gets
an anomaly claim, no matter how it compares to whatever thin data exists — silence is
the correct output when there isn't enough history, not a guess dressed up as a
finding.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal
from typing import Literal, TypedDict

MIN_TRAILING_MONTHS = 3
MIN_ANOMALY_AMOUNT = Decimal("50")
ANOMALY_MULTIPLIER = Decimal("2")
MIN_STREAK_MONTHS = 3  # 3 consecutive month-over-month increases


class CategorizedTransaction(TypedDict):
    category_id: int | None
    category_name: str | None
    transaction_type: str
    amount: Decimal
    date: date_type


@dataclass
class CategoryTrend:
    category_id: int | None
    category_name: str
    current_month_total: Decimal
    previous_month_total: Decimal | None
    mom_change_pct: float | None
    same_month_last_year_total: Decimal | None
    yoy_change_pct: float | None


@dataclass
class Insight:
    type: Literal["anomaly", "rising_streak"]
    category_id: int | None
    category_name: str
    message: str
    evidence: dict  # JSON-serializable numbers backing the claim — never a bare
    # assertion (design-system.md's "transparent AI" — every insight shows its
    # evidence, I6 renders this inline).


def _month_key(d: date_type) -> tuple[int, int]:
    return (d.year, d.month)


def _shift_month(year: int, month: int, offset: int) -> tuple[int, int]:
    idx = (year * 12 + (month - 1)) + offset
    return idx // 12, idx % 12 + 1


def _pct_change(current: Decimal, previous: Decimal) -> float | None:
    if previous == 0:
        return None
    return float((current - previous) / previous * 100)


def _monthly_expense_totals(
    transactions: list[CategorizedTransaction],
) -> dict[tuple[int | None, str], dict[tuple[int, int], Decimal]]:
    """{(category_id, category_name): {(year, month): total}} — expenses only;
    trends/anomalies are about spending, not income."""
    totals: dict[tuple[int | None, str], dict[tuple[int, int], Decimal]] = defaultdict(
        lambda: defaultdict(Decimal)
    )
    for tx in transactions:
        if tx["transaction_type"] != "expense":
            continue
        key = (tx["category_id"], tx["category_name"] or "Uncategorized")
        totals[key][_month_key(tx["date"])] += tx["amount"]
    return totals


def category_trends(
    transactions: list[CategorizedTransaction], reference_date: date_type
) -> list[CategoryTrend]:
    current_month = _month_key(reference_date)
    previous_month = _shift_month(*current_month, -1)
    same_month_last_year = (current_month[0] - 1, current_month[1])

    by_category = _monthly_expense_totals(transactions)
    trends: list[CategoryTrend] = []
    grand_current = Decimal(0)
    grand_previous = Decimal(0)
    grand_last_year = Decimal(0)
    any_previous = False
    any_last_year = False

    for (category_id, category_name), months in by_category.items():
        current_total = months.get(current_month, Decimal(0))
        previous_total = months.get(previous_month)
        last_year_total = months.get(same_month_last_year)

        grand_current += current_total
        if previous_total is not None:
            grand_previous += previous_total
            any_previous = True
        if last_year_total is not None:
            grand_last_year += last_year_total
            any_last_year = True

        if current_total == 0 and previous_total is None and last_year_total is None:
            continue

        trends.append(
            CategoryTrend(
                category_id=category_id,
                category_name=category_name,
                current_month_total=current_total,
                previous_month_total=previous_total,
                mom_change_pct=_pct_change(current_total, previous_total)
                if previous_total is not None
                else None,
                same_month_last_year_total=last_year_total,
                yoy_change_pct=_pct_change(current_total, last_year_total)
                if last_year_total is not None
                else None,
            )
        )

    trends.sort(key=lambda t: t.current_month_total, reverse=True)

    trends.insert(
        0,
        CategoryTrend(
            category_id=None,
            category_name="Total",
            current_month_total=grand_current,
            previous_month_total=grand_previous if any_previous else None,
            mom_change_pct=_pct_change(grand_current, grand_previous) if any_previous else None,
            same_month_last_year_total=grand_last_year if any_last_year else None,
            yoy_change_pct=_pct_change(grand_current, grand_last_year) if any_last_year else None,
        ),
    )
    return trends


def detect_insights(
    transactions: list[CategorizedTransaction], reference_date: date_type
) -> list[Insight]:
    current_month = _month_key(reference_date)
    by_category = _monthly_expense_totals(transactions)
    insights: list[Insight] = []

    for (category_id, category_name), months in by_category.items():
        current_total = months.get(current_month, Decimal(0))

        # Trailing months = the most recent months with actual spend strictly
        # before the current one — not just "the last 3 calendar months",
        # since a category with gaps shouldn't have zero-spend months silently
        # dragging its average down and manufacturing a false anomaly.
        prior_months = sorted(
            (mk for mk in months if mk < current_month and months[mk] > 0),
            reverse=True,
        )[:MIN_TRAILING_MONTHS]

        if current_total > 0 and len(prior_months) >= MIN_TRAILING_MONTHS:
            trailing_avg = sum((months[mk] for mk in prior_months), Decimal(0)) / len(prior_months)
            if (
                trailing_avg > 0
                and current_total >= MIN_ANOMALY_AMOUNT
                and current_total > trailing_avg * ANOMALY_MULTIPLIER
            ):
                multiplier = float(current_total / trailing_avg)
                insights.append(
                    Insight(
                        type="anomaly",
                        category_id=category_id,
                        category_name=category_name,
                        message=(
                            f"{category_name} spending is {multiplier:.1f}x your recent "
                            f"average this month"
                        ),
                        evidence={
                            "current_month_total": float(current_total),
                            "trailing_avg": float(trailing_avg),
                            "trailing_months_used": [f"{y}-{m:02d}" for y, m in prior_months],
                            "multiplier": round(multiplier, 2),
                        },
                    )
                )

        # Rising streak: current month plus the 3 months before it, strictly
        # increasing every step — requires all 4 to exist (no gaps), same honesty
        # rule as the anomaly check.
        streak_months = [_shift_month(*current_month, -i) for i in range(MIN_STREAK_MONTHS, -1, -1)]
        streak_totals = [months.get(mk) for mk in streak_months]
        if all(t is not None and t > 0 for t in streak_totals) and all(
            streak_totals[i] < streak_totals[i + 1] for i in range(len(streak_totals) - 1)
        ):
            insights.append(
                Insight(
                    type="rising_streak",
                    category_id=category_id,
                    category_name=category_name,
                    message=f"{category_name} spending has risen for {MIN_STREAK_MONTHS} months in a row",
                    evidence={
                        "months": [
                            {"month": f"{y}-{m:02d}", "total": float(months[(y, m)])}
                            for y, m in streak_months
                        ],
                    },
                )
            )

    return insights
