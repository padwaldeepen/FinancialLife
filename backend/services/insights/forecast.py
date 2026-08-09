"""Cash-flow forecast — backlog.md I4 / architecture-and-goals.md "Forecast (Phase I
core)". Pure function, no DB access (same split as recurring.py/trends.py) — the
router assembles the inputs (current cash balance, I1's detected recurring charges,
a trailing average daily discretionary spend) and this simulates forward.

Honesty rule (this ticket's explicit accept criterion): with under ~2 months of
transaction history, a forecast is a guess wearing a graph, not a prediction — the
router checks history span and this function's `insufficient_data` output path is
used instead of simulating on thin data.
"""

from dataclasses import dataclass
from datetime import date as date_type
from datetime import timedelta
from decimal import Decimal

from services.insights.recurring import CADENCES, RecurringCharge

MIN_HISTORY_DAYS = 60
INSUFFICIENT_DATA_MESSAGE = "Needs about 2 months of transaction history for an accurate forecast"


@dataclass
class ForecastDay:
    date: date_type
    balance: Decimal
    income: Decimal
    expenses: Decimal


@dataclass
class ForecastResult:
    days: list[ForecastDay]
    crunch_points: list[date_type]  # dates where balance drops below the buffer
    insufficient_data: bool
    message: str | None


def _occurrences_in_window(
    charge: RecurringCharge, start_date: date_type, end_date: date_type
) -> list[date_type]:
    """Every predicted occurrence of a recurring charge between start_date and
    end_date inclusive, stepping forward (or back, if `next_expected_date` is
    already past the window start — a charge detected mid-history can have its
    next-expected date behind "today") by the cadence's day count."""
    target_days, _tolerance = CADENCES[charge.cadence]
    occurrences: list[date_type] = []

    d = charge.next_expected_date
    # Walk backward first so occurrences that would otherwise fall before the window
    # (next_expected_date computed from the last historical transaction, which may
    # predate start_date) are still counted once they land inside it.
    while d > start_date:
        d -= timedelta(days=target_days)
    while d < start_date:
        d += timedelta(days=target_days)

    while d <= end_date:
        occurrences.append(d)
        d += timedelta(days=target_days)

    return occurrences


def simulate(
    start_balance: Decimal,
    start_date: date_type,
    horizon_days: int,
    recurring_charges: list[RecurringCharge],
    avg_daily_discretionary: Decimal,
    history_span_days: int,
    buffer: Decimal = Decimal(0),
) -> ForecastResult:
    if history_span_days < MIN_HISTORY_DAYS:
        return ForecastResult(
            days=[], crunch_points=[], insufficient_data=True, message=INSUFFICIENT_DATA_MESSAGE
        )

    end_date = start_date + timedelta(days=horizon_days)

    # date -> [income, expenses] from recurring charges landing on that day.
    scheduled: dict[date_type, list[Decimal]] = {}
    for charge in recurring_charges:
        for occurrence_date in _occurrences_in_window(charge, start_date, end_date):
            bucket = scheduled.setdefault(occurrence_date, [Decimal(0), Decimal(0)])
            if charge.transaction_type == "income":
                bucket[0] += charge.avg_amount
            else:
                bucket[1] += charge.avg_amount

    days: list[ForecastDay] = []
    crunch_points: list[date_type] = []
    balance = start_balance

    for offset in range(horizon_days + 1):
        d = start_date + timedelta(days=offset)
        income, expenses = scheduled.get(d, (Decimal(0), Decimal(0)))
        balance = balance + income - expenses - avg_daily_discretionary
        days.append(ForecastDay(date=d, balance=balance, income=income, expenses=expenses))
        if balance < buffer:
            crunch_points.append(d)

    return ForecastResult(
        days=days, crunch_points=crunch_points, insufficient_data=False, message=None
    )
