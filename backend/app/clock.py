"""Server clock with an admin-controlled demo override.

Everything in the app that needs "now" (cutoff checks, order dates, payment
timestamps) goes through `now()` here so the admin "demo clock override" can move
time forward on demand without waiting for the real clock.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CLOCK_OVERRIDE_KEY, AppSetting

TZ = ZoneInfo(settings.app_timezone)


def real_now() -> datetime:
    return datetime.now(TZ)


def get_override(db: Session) -> datetime | None:
    row = db.get(AppSetting, CLOCK_OVERRIDE_KEY)
    if not row or not row.value:
        return None
    try:
        dt = datetime.fromisoformat(row.value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


def set_override(db: Session, value: datetime | None) -> None:
    row = db.get(AppSetting, CLOCK_OVERRIDE_KEY)
    if row is None:
        row = AppSetting(key=CLOCK_OVERRIDE_KEY)
        db.add(row)
    row.value = value.isoformat() if value else None
    db.flush()


def now(db: Session | None = None) -> datetime:
    """Current time in the app timezone, honouring the demo override if set."""
    if db is not None:
        override = get_override(db)
        if override is not None:
            return override
    return real_now()
