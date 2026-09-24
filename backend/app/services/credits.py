"""Carry-forward credit ledger.

When a customer cancels a meal that qualifies (it is still inside the allowed
window — the router enforces that before calling here), the plate value is booked
as a `MealCredit` tied to their account. It is a standing balance carried forward
to future meals; it is never negative and never auto-spent here.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdHocOrder, MealCredit, Subscription


def plate_value(sub: Subscription) -> float:
    """What one day of this subscription is worth."""
    return round(float(sub.price) * int(sub.plates_per_day), 2)


def issue_for_skip(
    db: Session,
    sub: Subscription,
    meal_date: date,
    *,
    skip_id: int | None,
    created_by: str = "customer",
) -> MealCredit | None:
    """Book a carry-forward credit for a just-created cancellation. Idempotent per
    (user, meal_date, meal_type): a second call returns the existing row."""
    existing = db.scalar(
        select(MealCredit).where(
            MealCredit.user_id == sub.user_id,
            MealCredit.meal_date == meal_date,
            MealCredit.meal_type == sub.meal_type,
        )
    )
    if existing is not None:
        return existing

    amount = plate_value(sub)
    if amount <= 0:
        return None

    credit = MealCredit(
        user_id=sub.user_id,
        amount=amount,
        reason="cancellation",
        meal_date=meal_date,
        meal_type=sub.meal_type,
        subscription_id=sub.id,
        source_skip_id=skip_id,
        created_by=created_by,
        status="available",
        note=f"{sub.meal_type.capitalize()} on {meal_date:%d %b %Y} cancelled",
    )
    db.add(credit)
    db.flush()
    return credit


def issue_for_order_cancel(
    db: Session, order: AdHocOrder, *, created_by: str = "customer"
) -> MealCredit | None:
    """Book a carry-forward credit for a just-cancelled one-off order. Idempotent
    per order — keyed on the order itself (not date+meal_type) so a subscription
    meal and an ad-hoc order on the same date/meal both get their own credit."""
    existing = db.scalar(select(MealCredit).where(MealCredit.source_order_id == order.id))
    if existing is not None:
        return existing

    amount = round(float(order.amount), 2)
    if amount <= 0:
        return None

    credit = MealCredit(
        user_id=order.user_id,
        amount=amount,
        reason="cancellation",
        meal_date=order.date,
        meal_type=order.meal_type,
        source_order_id=order.id,
        created_by=created_by,
        status="available",
        note=f"One-off {order.meal_type} order on {order.date:%d %b %Y} cancelled",
    )
    db.add(credit)
    db.flush()
    return credit


def void_for_order_cancel(db: Session, order_id: int) -> None:
    """Remove the credit that backed an order cancellation now reversed (e.g. the
    kitchen reinstates an order it had marked cancelled)."""
    row = db.scalar(select(MealCredit).where(MealCredit.source_order_id == order_id))
    if row is not None:
        db.delete(row)
        db.flush()


def void_for_skip(db: Session, *, user_id: int, meal_date: date, meal_type: str) -> None:
    """Remove the credit that backed a cancellation the customer has now restored."""
    row = db.scalar(
        select(MealCredit).where(
            MealCredit.user_id == user_id,
            MealCredit.meal_date == meal_date,
            MealCredit.meal_type == meal_type,
            MealCredit.reason == "cancellation",
        )
    )
    if row is not None:
        db.delete(row)
        db.flush()


def balance(db: Session, user_id: int) -> float:
    rows = db.scalars(
        select(MealCredit.amount).where(
            MealCredit.user_id == user_id, MealCredit.status == "available"
        )
    ).all()
    return round(sum(float(x) for x in rows), 2)


def ledger(db: Session, user_id: int) -> list[MealCredit]:
    return list(
        db.scalars(
            select(MealCredit)
            .where(MealCredit.user_id == user_id)
            .order_by(MealCredit.created_at.desc(), MealCredit.id.desc())
        ).all()
    )
