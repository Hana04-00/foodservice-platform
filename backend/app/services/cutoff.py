"""Server-side cutoff enforcement for ordering and cancelling.

Rules (checked against the app clock, which the admin demo override can move):
  * Lunch  can be ordered/cancelled only until 10:00 on the delivery date.
  * Dinner can be ordered/cancelled only until 18:00 on the delivery date.
  * Dates before "today" are always closed; dates after "today" are always open.
"""
from __future__ import annotations

from datetime import date, datetime, time

LUNCH_CUTOFF = time(10, 0)
DINNER_CUTOFF = time(18, 0)

CUTOFFS: dict[str, time] = {"lunch": LUNCH_CUTOFF, "dinner": DINNER_CUTOFF}


class CutoffError(Exception):
    """Raised when an order/cancel is attempted after its cutoff."""


def cutoff_for(meal_type: str) -> time:
    try:
        return CUTOFFS[meal_type]
    except KeyError:  # pragma: no cover - guarded by schema validation
        raise CutoffError(f"Unknown meal type: {meal_type!r}")


def is_open(meal_type: str, target: date, now: datetime) -> bool:
    """Whether `meal_type` on `target` can still be ordered/cancelled at `now`."""
    today = now.date()
    if target < today:
        return False
    if target > today:
        return True
    return now.timetz().replace(tzinfo=None) < cutoff_for(meal_type)


def assert_open(meal_type: str, target: date, now: datetime, *, action: str = "order") -> None:
    if is_open(meal_type, target, now):
        return
    cutoff = cutoff_for(meal_type)
    label = meal_type.capitalize()
    if target < now.date():
        msg = f"{label} for {target:%d %b} has already passed — you can no longer {action} it."
    else:
        msg = (
            f"{label} for {target:%d %b} closed at {cutoff:%H:%M}. "
            f"It's now {now:%H:%M} — too late to {action}."
        )
    raise CutoffError(msg)
