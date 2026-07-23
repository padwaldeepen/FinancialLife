"""Safe-to-spend — backlog.md I5 / the number on Home's hero card. Pure function, no
DB access (same split as the rest of services/insights/) — reuses I1's detected
recurring charges for "next payday" and "bills before then" rather than re-deriving
either.

`safe_to_spend = cash balance − (bills due before next payday) − (goal contributions
due)`. Same honesty gate as I4's forecast (this IS a thin wrapper around the same
underlying recurring-detection foundation, so the same "not enough history yet"
condition applies): under ~2 months of transaction history, this returns
`insufficient_data=True` instead of a number built on too little evidence.
"""

from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal

from services.insights.forecast import INSUFFICIENT_DATA_MESSAGE, MIN_HISTORY_DAYS
from services.insights.recurring import RecurringCharge


@dataclass
class SafeToSpendResult:
    insufficient_data: bool
    message: str | None
    safe_to_spend: Decimal | None
    cash_balance: Decimal | None
    next_payday: date_type | None
    days_until_payday: int | None
    bills_before_payday: Decimal
    goal_contributions_due: Decimal


def compute(
    cash_balance: Decimal,
    recurring_charges: list[RecurringCharge],
    goal_monthly_contributions: list[Decimal],
    reference_date: date_type,
    history_span_days: int,
) -> SafeToSpendResult:
    if history_span_days < MIN_HISTORY_DAYS:
        return SafeToSpendResult(
            insufficient_data=True,
            message=INSUFFICIENT_DATA_MESSAGE,
            safe_to_spend=None,
            cash_balance=None,
            next_payday=None,
            days_until_payday=None,
            bills_before_payday=Decimal(0),
            goal_contributions_due=Decimal(0),
        )

    income_dates = sorted(
        c.next_expected_date for c in recurring_charges if c.transaction_type == "income"
    )
    # No detected income pattern yet (irregular income, or too new to have 3+
    # occurrences) — still a real number, just with no payday-anchored bill window;
    # not the same "insufficient data" case as too-little-history overall.
    next_payday = income_dates[0] if income_dates else None
    days_until_payday = (next_payday - reference_date).days if next_payday else None

    bills_before_payday = (
        sum(
            (
                c.avg_amount
                for c in recurring_charges
                if c.transaction_type == "expense" and c.next_expected_date < next_payday
            ),
            Decimal(0),
        )
        if next_payday
        else Decimal(0)
    )

    goal_contributions_due = sum(goal_monthly_contributions, Decimal(0))

    safe_to_spend = cash_balance - bills_before_payday - goal_contributions_due

    return SafeToSpendResult(
        insufficient_data=False,
        message=None,
        safe_to_spend=safe_to_spend,
        cash_balance=cash_balance,
        next_payday=next_payday,
        days_until_payday=days_until_payday,
        bills_before_payday=bills_before_payday,
        goal_contributions_due=goal_contributions_due,
    )
