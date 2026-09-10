"""Customer view of their own subscriptions: see the plan + upcoming schedule,
skip / un-skip a single day's meal (cutoff-enforced), or cancel a subscription.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.clock import now as clock_now
from app.database import get_db
from app.deps import get_current_user
from app.models import MealSkip, Subscription, User
from app.schemas import ScheduleDay, SkipRequest, SubscriptionWithSchedule
from app.services import credits
from app.services.cutoff import CutoffError, assert_open, is_open
from app.services.plates import covers, upcoming_schedule

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _load(db: Session, sub_id: int) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.id == sub_id)
    )


def _with_schedule(db: Session, sub: Subscription) -> SubscriptionWithSchedule:
    now = clock_now(db)
    out = SubscriptionWithSchedule.from_model(sub)
    schedule: list[ScheduleDay] = []
    if sub.status == "active":
        for d, served, skipped in upcoming_schedule(db, sub, now.date(), days=14):
            schedule.append(
                ScheduleDay(
                    date=d,
                    weekday=WEEKDAYS[d.weekday()],
                    served=served,
                    skipped=skipped,
                    locked=not is_open(sub.meal_type, d, now),
                )
            )
    out.schedule = schedule
    return out


def _owned(db: Session, sub_id: int, user: User) -> Subscription:
    sub = _load(db, sub_id)
    if sub is None or sub.user_id != user.id:
        raise HTTPException(404, "Subscription not found")
    return sub


@router.get("/me", response_model=list[SubscriptionWithSchedule])
def my_subscriptions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SubscriptionWithSchedule]:
    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.meal_type)
    ).all()
    return [_with_schedule(db, s) for s in subs]


@router.post("/{sub_id}/skip", response_model=SubscriptionWithSchedule)
def skip_meal(
    sub_id: int,
    body: SkipRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubscriptionWithSchedule:
    sub = _owned(db, sub_id, user)
    if sub.status != "active":
        raise HTTPException(409, "This subscription isn't active.")
    if not covers(sub, body.date):
        raise HTTPException(
            422, f"No {sub.meal_type} is scheduled for {body.date:%d %b}."
        )
    now = clock_now(db)
    try:
        assert_open(sub.meal_type, body.date, now, action="skip")
    except CutoffError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))

    exists = db.scalar(
        select(MealSkip).where(
            MealSkip.subscription_id == sub.id, MealSkip.date == body.date
        )
    )
    if exists is None:
        skip = MealSkip(subscription_id=sub.id, date=body.date, created_by="customer")
        db.add(skip)
        db.flush()
        credits.issue_for_skip(db, sub, body.date, skip_id=skip.id, created_by="customer")
        db.commit()
    return _with_schedule(db, _load(db, sub.id))


@router.delete("/{sub_id}/skip/{skip_date}", response_model=SubscriptionWithSchedule)
def unskip_meal(
    sub_id: int,
    skip_date: date,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubscriptionWithSchedule:
    sub = _owned(db, sub_id, user)
    now = clock_now(db)
    try:
        assert_open(sub.meal_type, skip_date, now, action="restore")
    except CutoffError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    skip = db.scalar(
        select(MealSkip).where(
            MealSkip.subscription_id == sub.id, MealSkip.date == skip_date
        )
    )
    if skip is not None:
        credits.void_for_skip(
            db, user_id=sub.user_id, meal_date=skip_date, meal_type=sub.meal_type
        )
        db.delete(skip)
        db.commit()
    return _with_schedule(db, _load(db, sub.id))


@router.post("/{sub_id}/cancel", response_model=SubscriptionWithSchedule)
def cancel_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubscriptionWithSchedule:
    sub = _owned(db, sub_id, user)
    sub.status = "cancelled"
    db.commit()
    return _with_schedule(db, _load(db, sub.id))
