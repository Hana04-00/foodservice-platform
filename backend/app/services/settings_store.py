"""Read/write the business settings key/value rows, falling back to defaults."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BUSINESS_SETTING_DEFAULTS, AppSetting


def get_all(db: Session) -> dict[str, str]:
    rows = {
        r.key: r.value
        for r in db.scalars(select(AppSetting)).all()
        if r.key in BUSINESS_SETTING_DEFAULTS
    }
    return {k: (rows.get(k) or v) for k, v in BUSINESS_SETTING_DEFAULTS.items()}


def update(db: Session, values: dict[str, str]) -> dict[str, str]:
    for key, value in values.items():
        if key not in BUSINESS_SETTING_DEFAULTS:
            continue
        row = db.get(AppSetting, key)
        if row is None:
            row = AppSetting(key=key)
            db.add(row)
        row.value = str(value)
    db.flush()
    return get_all(db)
