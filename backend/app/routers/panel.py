"""Customer panel: dashboard, meal calendar, meal history, credits.

All read models over the same subscriptions + skips + credits the admin panel
sees, so a cancel here shows up there with no sync step.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.clock import now as clock_now
from app.database import get_db
from app.deps import get_current_user
from app.models import Invoice, MealCredit, MealSkip, Subscription, User
from app.schemas import WEEKDAY_NAMES
from app.services import credits as credits_svc
from app.services import settings_store
from app.services.cutoff import is_open
from app.services.invoicing import month_bounds
from app.services.plates import covers, served_dates, skipped_dates

router = APIRouter(prefix="/panel", tags=["panel"])


def _subs(db: Session, user_id: int) -> list[Subscription]:
    return list(
        db.scalars(
            select(Subscription)
            .options(joinedload(Subscription.menu_item))
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.meal_type)
        ).all()
    )


def _greeting(hour: int) -> str:
    if hour < 12:
        return "Good Morning"
    if hour < 17:
        return "Good Afternoon"
    return "Good Evening"


def _dish(sub: Subscription) -> str:
    return sub.menu_item.name if sub.menu_item else "Kitchen's choice"


# --------------------------------------------------------------- dashboard
@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    now = clock_now(db)
    today = now.date()
    subs = _subs(db, user.id)
    active = [s for s in subs if s.status == "active"]
    m_start, m_end = month_bounds(today.year, today.month)

    skips_by_sub = {s.id: skipped_dates(db, s.id) for s in subs}

    total_meals = 0
    consumed = 0
    cancelled_month = 0
    for s in active:
        d = m_start
        while d <= m_end:
            if covers(s, d):
                total_meals += s.plates_per_day
                if d in skips_by_sub.get(s.id, set()):
                    if m_start <= d <= m_end:
                        cancelled_month += s.plates_per_day
                elif d <= today:
                    consumed += s.plates_per_day
            d += timedelta(days=1)
    remaining = max(total_meals - consumed - cancelled_month, 0)

    # upcoming meals (next 10 scheduled slots)
    upcoming: list[dict] = []
    for i in range(21):
        d = today + timedelta(days=i)
        for s in active:
            if not covers(s, d):
                continue
            skipped = d in skips_by_sub.get(s.id, set())
            if skipped and i == 0:
                pass
            upcoming.append(
                {
                    "date": d.isoformat(),
                    "weekday": WEEKDAY_NAMES[d.weekday()],
                    "meal_type": s.meal_type,
                    "dish": _dish(s),
                    "status": "cancelled" if skipped else "scheduled",
                    "locked": not is_open(s.meal_type, d, now),
                }
            )
        if len(upcoming) >= 10:
            break

    # recent activity
    activity: list[dict] = []
    recent_skips = db.scalars(
        select(MealSkip)
        .join(Subscription, MealSkip.subscription_id == Subscription.id)
        .where(Subscription.user_id == user.id)
        .order_by(MealSkip.created_at.desc())
        .limit(8)
    ).all()
    sub_by_id = {s.id: s for s in subs}
    for sk in recent_skips:
        s = sub_by_id.get(sk.subscription_id)
        if not s:
            continue
        cr = db.scalar(
            select(MealCredit).where(
                MealCredit.user_id == user.id,
                MealCredit.meal_date == sk.date,
                MealCredit.meal_type == s.meal_type,
            )
        )
        activity.append(
            {
                "when": (sk.created_at or now).isoformat(),
                "date": sk.date.isoformat(),
                "type": "cancelled",
                "meal_type": s.meal_type,
                "detail": f"{s.meal_type.capitalize()} on {sk.date:%d %b} cancelled",
                "credit_impact": float(cr.amount) if cr else 0.0,
            }
        )
    for inv in db.scalars(
        select(Invoice)
        .where(Invoice.user_id == user.id)
        .order_by(Invoice.generated_at.desc())
        .limit(3)
    ).all():
        activity.append(
            {
                "when": inv.generated_at.isoformat() if inv.generated_at else now.isoformat(),
                "date": f"{inv.period_year}-{inv.period_month:02d}",
                "type": "renewed",
                "meal_type": "",
                "detail": f"Invoice for {inv.period_year}-{inv.period_month:02d} generated ({inv.plates} plates)",
                "credit_impact": 0.0,
            }
        )
    # a few recently consumed meals
    for s in active:
        served = served_dates(db, s, today - timedelta(days=6), today, today)
        for d in served[-3:]:
            activity.append(
                {
                    "when": f"{d.isoformat()}T12:00:00",
                    "date": d.isoformat(),
                    "type": "consumed",
                    "meal_type": s.meal_type,
                    "detail": f"{s.meal_type.capitalize()} on {d:%d %b} served",
                    "credit_impact": 0.0,
                }
            )
    activity.sort(key=lambda a: a["when"], reverse=True)

    return {
        "name": user.name,
        "greeting": _greeting(now.hour),
        "today": today.isoformat(),
        "month_label": today.strftime("%B %Y"),
        "has_subscription": bool(active),
        "stats": {
            "total_meals": total_meals,
            "meals_consumed": consumed,
            "meals_remaining": remaining,
            "carry_forward_credit": credits_svc.balance(db, user.id),
        },
        "upcoming_meals": upcoming[:10],
        "recent_activity": activity[:12],
    }


# --------------------------------------------------------------- meal history
@router.get("/meals/history")
def meal_history(
    filter: str = Query(default="all"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    now = clock_now(db)
    today = now.date()
    subs = _subs(db, user.id)
    start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)  # start of last month
    end = today + timedelta(days=14)

    skip_rows = {
        (sk.subscription_id, sk.date): sk
        for sk in db.scalars(
            select(MealSkip)
            .join(Subscription, MealSkip.subscription_id == Subscription.id)
            .where(Subscription.user_id == user.id)
        ).all()
    }
    credit_rows = {
        (c.meal_date, c.meal_type): c
        for c in db.scalars(
            select(MealCredit).where(MealCredit.user_id == user.id)
        ).all()
    }

    rows: list[dict] = []
    for s in subs:
        d = start
        while d <= end:
            # raw weekday/window check so paused subs still show their past meals
            in_window = (
                d >= s.start_date
                and (s.end_date is None or d <= s.end_date)
                and d.weekday() in s.weekday_set
            )
            if in_window and s.status in ("active", "paused"):
                sk = skip_rows.get((s.id, d))
                cr = credit_rows.get((d, s.meal_type))
                if sk is not None:
                    status = "cancelled"
                elif d < today or (d == today and not is_open(s.meal_type, d, now)):
                    status = "consumed"
                else:
                    status = "upcoming"
                rows.append(
                    {
                        "date": d.isoformat(),
                        "weekday": WEEKDAY_NAMES[d.weekday()],
                        "meal_type": s.meal_type,
                        "dish": _dish(s),
                        "status": status,
                        "amount": round(float(s.price) * s.plates_per_day, 2),
                        "plates": s.plates_per_day,
                        "order_date": (s.created_at.date().isoformat() if s.created_at else s.start_date.isoformat()),
                        "start_date": s.start_date.isoformat(),
                        "credit": float(cr.amount) if cr else 0.0,
                        "cancelled_at": (sk.created_at.isoformat() if sk and sk.created_at else None),
                    }
                )
            d += timedelta(days=1)

    rows.sort(key=lambda r: (r["date"], r["meal_type"]), reverse=True)

    f = (filter or "all").lower()
    if f == "consumed":
        view = [r for r in rows if r["status"] == "consumed"]
    elif f == "cancelled":
        view = [r for r in rows if r["status"] == "cancelled"]
    elif f == "credits":
        view = [r for r in rows if r["credit"] > 0]
    else:
        view = rows

    return {
        "filter": f,
        "counts": {
            "all": len(rows),
            "consumed": sum(1 for r in rows if r["status"] == "consumed"),
            "cancelled": sum(1 for r in rows if r["status"] == "cancelled"),
            "credits": sum(1 for r in rows if r["credit"] > 0),
        },
        "items": view,
    }


# --------------------------------------------------------------- calendar
@router.get("/meals/calendar")
def meal_calendar(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    now = clock_now(db)
    today = now.date()
    year = year or today.year
    month = month or today.month
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])

    subs = [s for s in _subs(db, user.id) if s.status in ("active", "paused")]
    skips_by_sub = {s.id: skipped_dates(db, s.id) for s in subs}
    credit_rows = {
        (c.meal_date, c.meal_type)
        for c in db.scalars(select(MealCredit).where(MealCredit.user_id == user.id)).all()
    }
    notice = settings_store.get_all(db).get("cancellation_notice_hours", "4")

    days: list[dict] = []
    d = first
    while d <= last:
        entry: dict = {"date": d.isoformat(), "weekday": WEEKDAY_NAMES[d.weekday()], "is_today": d == today, "meals": {}}
        for s in subs:
            in_window = (
                d >= s.start_date
                and (s.end_date is None or d <= s.end_date)
                and d.weekday() in s.weekday_set
            )
            if not in_window:
                continue
            skipped = d in skips_by_sub.get(s.id, set())
            entry["meals"][s.meal_type] = {
                "dish": _dish(s),
                "scheduled": True,
                "cancelled": skipped,
                "credit": (d, s.meal_type) in credit_rows,
                "locked": not is_open(s.meal_type, d, now),
                "subscription_id": s.id,
                "amount": round(float(s.price) * s.plates_per_day, 2),
            }
        days.append(entry)
        d += timedelta(days=1)

    prev_m = (year - 1, 12) if month == 1 else (year, month - 1)
    next_m = (year + 1, 1) if month == 12 else (year, month + 1)
    return {
        "year": year,
        "month": month,
        "month_label": first.strftime("%B %Y"),
        "first_weekday": first.weekday(),  # Mon=0
        "today": today.isoformat(),
        "cancellation_notice_hours": notice,
        "prev": {"year": prev_m[0], "month": prev_m[1]},
        "next": {"year": next_m[0], "month": next_m[1]},
        "days": days,
    }


# --------------------------------------------------------------- credits
@router.get("/credits")
def my_credits(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    rows = credits_svc.ledger(db, user.id)
    items = [
        {
            "id": c.id,
            "issued_on": c.created_at.isoformat() if c.created_at else None,
            "meal_date": c.meal_date.isoformat(),
            "meal_type": c.meal_type,
            "amount": float(c.amount),
            "reason": c.reason,
            "status": c.status,
            "note": c.note,
            "issued_by": c.created_by,
        }
        for c in rows
    ]
    return {
        "balance": credits_svc.balance(db, user.id),
        "total_earned": round(sum(i["amount"] for i in items), 2),
        "count": len(items),
        "items": items,
    }
