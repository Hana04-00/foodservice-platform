"""Daily "plate" maths: turn standing subscriptions + per-day skips + admin-entered
ad-hoc orders into the kitchen's prep counts, and into the served-plate counts that
billing bills on.

A subscription "covers" a date when it is active, the date is inside its
[start_date, end_date] window, and the date's weekday is in its weekday set
(Monday=0 .. Sunday=6, matching `date.weekday()`).
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import AdHocOrder, MealSkip, Subscription

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def covers(sub: Subscription, d: date) -> bool:
    if sub.status != "active":
        return False
    if d < sub.start_date:
        return False
    if sub.end_date is not None and d > sub.end_date:
        return False
    return d.weekday() in sub.weekday_set


def skipped_dates(db: Session, subscription_id: int) -> set[date]:
    rows = db.scalars(
        select(MealSkip.date).where(MealSkip.subscription_id == subscription_id)
    ).all()
    return set(rows)


def served_dates(
    db: Session, sub: Subscription, start: date, end: date, today: date
) -> list[date]:
    """Dates in [start, end] the customer actually gets a plate: covered, not
    skipped, and not in the future (billing only bills what has been served)."""
    if end > today:
        end = today
    if start > end:
        return []
    skips = skipped_dates(db, sub.id)
    out: list[date] = []
    d = start
    while d <= end:
        if covers(sub, d) and d not in skips:
            out.append(d)
        d += timedelta(days=1)
    return out


def upcoming_schedule(db: Session, sub: Subscription, from_date: date, days: int = 14):
    """[(date, served, skipped)] for the next `days` days from `from_date`."""
    skips = skipped_dates(db, sub.id)
    out = []
    for i in range(days):
        d = from_date + timedelta(days=i)
        is_skip = d in skips
        out.append((d, covers(sub, d) and not is_skip, is_skip))
    return out


def adhoc_orders_between(
    db: Session, start: date, end: date, user_id: int | None = None, include_cancelled: bool = False
) -> list[AdHocOrder]:
    stmt = (
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(AdHocOrder.date >= start, AdHocOrder.date <= end)
    )
    if user_id is not None:
        stmt = stmt.where(AdHocOrder.user_id == user_id)
    if not include_cancelled:
        stmt = stmt.where(AdHocOrder.status != "cancelled")
    return list(db.scalars(stmt).unique().all())


def plate_report(db: Session, target: date) -> dict:
    """Merged per-meal kitchen view for `target`: subscription plates, minus skips,
    plus ad-hoc orders — with the per-customer breakdown."""
    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item), joinedload(Subscription.user))
        .where(Subscription.status == "active")
    ).unique().all()

    skipped_sub_ids = set(
        db.scalars(select(MealSkip.subscription_id).where(MealSkip.date == target)).all()
    )
    adhoc = adhoc_orders_between(db, target, target)

    # meal -> user_id -> row dict
    meals: dict[str, dict[int, dict]] = {"lunch": {}, "dinner": {}}

    def _row(meal: str, uid: int, name: str, phone: str) -> dict:
        r = meals[meal].get(uid)
        if r is None:
            r = {
                "user_id": uid, "name": name, "phone": phone, "type": None,
                "item_name": "", "regular": 0, "adjustment": 0, "notes": "",
            }
            meals[meal][uid] = r
        return r

    for s in subs:
        if s.meal_type not in meals or not covers(s, target):
            continue
        r = _row(s.meal_type, s.user_id, s.user.name if s.user else "", s.user.phone if s.user else "")
        r["type"] = "subscription"
        r["regular"] += s.plates_per_day
        r["item_name"] = s.menu_item.name if s.menu_item else "Kitchen's choice"
        if s.id in skipped_sub_ids:
            r["adjustment"] -= s.plates_per_day
            r["notes"] = "Cancelled"

    for o in adhoc:
        if o.meal_type not in meals:
            continue
        u = o.user
        r = _row(o.meal_type, o.user_id, u.name if u else "", u.phone if u else "")
        qty = o.total_qty
        r["adjustment"] += qty
        r["type"] = "both" if r["type"] == "subscription" else "order"
        extra = ", ".join(f"{i.qty}× {i.item_name}" for i in o.items)
        note = f"Extra: {extra}" + (f" — {o.notes}" if o.notes else "")
        r["notes"] = (r["notes"] + " · " + note).strip(" ·") if r["notes"] else note
        if not r["item_name"]:
            r["item_name"] = o.items[0].item_name if o.items else "Extra plate"

    def _finish(meal: str) -> dict:
        rows = []
        prep: dict[str, int] = {}
        count = reg_total = adj_total = 0
        for r in meals[meal].values():
            total = max(r["regular"] + r["adjustment"], 0)
            rows.append({**r, "type": r["type"] or "order", "total": total})
            count += total
            reg_total += r["regular"]
            adj_total += r["adjustment"]
        # prep counts: subscription item for the non-skipped regular part, plus ad-hoc items
        for o in adhoc:
            if o.meal_type != meal:
                continue
            for i in o.items:
                prep[i.item_name] = prep.get(i.item_name, 0) + i.qty
        for s in subs:
            if s.meal_type != meal or not covers(s, target) or s.id in skipped_sub_ids:
                continue
            nm = s.menu_item.name if s.menu_item else "Kitchen's choice"
            prep[nm] = prep.get(nm, 0) + s.plates_per_day
        return {
            "count": count,
            "regular_total": reg_total,
            "adjustment_total": adj_total,
            "prep": [
                {"item_name": k, "plates": v}
                for k, v in sorted(prep.items(), key=lambda kv: -kv[1])
            ],
            "rows": sorted(rows, key=lambda r: r["name"]),
        }

    lunch = _finish("lunch")
    dinner = _finish("dinner")
    return {
        "date": target,
        "weekday": WEEKDAYS[target.weekday()],
        "lunch": lunch,
        "dinner": dinner,
        "total": lunch["count"] + dinner["count"],
    }
