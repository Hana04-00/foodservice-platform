"""Admin panel: dashboard, kitchen plate report, customers + their subscriptions,
subscription list, monthly invoicing with partial payments, and the demo clock."""
from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.clock import now as clock_now, real_now, set_override
from app.database import get_db
from app.deps import require_admin
from app.models import (
    AdHocOrder,
    FoodRequest,
    Invoice,
    MealCredit,
    MealSkip,
    MenuItem,
    ServiceArea,
    Subscription,
    User,
)
from app.schemas import (
    AdHocOrderOut,
    AdminCustomerCreate,
    AdminCustomerUpdate,
    ClockOverrideIn,
    ClockStatus,
    InvoiceOut,
    InvoicePayRequest,
    InvoiceRecordPayment,
    PlateReport,
    SkipRequest,
    SubscriptionCreate,
    SubscriptionListItem,
    SubscriptionOut,
    SubscriptionUpdate,
    UpcomingChange,
    WEEKDAY_NAMES,
)
from app.security import hash_secret
from app.services import credits as credits_svc
from app.services import settings_store
from app.services.invoicing import build_invoice, mark_paid, month_bounds, record_payment
from app.services.plates import (
    adhoc_orders_between,
    covers,
    plate_report,
    served_dates,
    skipped_dates,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _invoice_remaining(inv: Invoice) -> float:
    return round(float(inv.amount) - float(inv.amount_paid or 0), 2)


# --------------------------------------------------------------- dashboard
@router.get("/dashboard")
def dashboard(
    on: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
) -> dict:
    now = clock_now(db)
    day = on or now.date()
    report = plate_report(db, day)

    total_customers = db.scalar(select(func.count(User.id))) or 0
    active_subs = (
        db.scalar(select(func.count(Subscription.id)).where(Subscription.status == "active"))
        or 0
    )

    orders_today = db.scalars(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items))
        .where(AdHocOrder.date == day, AdHocOrder.status != "cancelled")
    ).unique().all()
    extra_plates = sum(o.total_qty for o in orders_today)
    cancelled_today = sum(
        1 for m in ("lunch", "dinner") for r in report[m]["rows"] if "Cancelled" in r["notes"]
    )

    m_start, m_end = month_bounds(day.year, day.month)
    period_invs = db.scalars(
        select(Invoice).where(
            Invoice.period_year == day.year, Invoice.period_month == day.month
        )
    ).all()
    collected_period = round(sum(float(i.amount_paid or 0) for i in period_invs), 2)
    pending_period = round(sum(_invoice_remaining(i) for i in period_invs), 2)
    outstanding_total = round(
        float(
            db.scalar(
                select(func.coalesce(func.sum(Invoice.amount - Invoice.amount_paid), 0)).where(
                    Invoice.status != "paid"
                )
            )
            or 0
        ),
        2,
    )

    type_label = {"subscription": "Subscription", "order": "Order", "both": "Sub + order"}
    todays_meals = []
    for m in ("lunch", "dinner"):
        for r in report[m]["rows"][:12]:
            todays_meals.append(
                {
                    "customer_name": r["name"],
                    "type": type_label.get(r["type"], "Subscription"),
                    "meal": m,
                    "qty": r["total"],
                    "status": "Cancelled" if r["total"] == 0 else "Scheduled",
                }
            )

    biz = settings_store.get_all(db)
    cap = {
        "lunch": int(biz.get("lunch_capacity") or 0),
        "dinner": int(biz.get("dinner_capacity") or 0),
    }
    meal_requirement = []
    for m in ("lunch", "dinner"):
        required = report[m]["regular_total"] + max(report[m]["adjustment_total"], 0)
        confirmed = report[m]["count"]
        meal_requirement.append(
            {
                "meal_type": m,
                "required": required,
                "confirmed": confirmed,
                "gap": required - confirmed,
                "capacity": cap[m],
            }
        )

    cancellations_today = _cancellation_rows(db, day, day)
    new_food_requests = (
        db.scalar(select(func.count(FoodRequest.id)).where(FoodRequest.status == "new")) or 0
    )
    new_orders = (
        db.scalar(select(func.count(AdHocOrder.id)).where(AdHocOrder.status == "confirmed")) or 0
    )

    return {
        "as_of": now.isoformat(),
        "date": day.isoformat(),
        "weekday": report["weekday"],
        "total_customers": total_customers,
        "active_subscriptions": active_subs,
        "lunch_plates": report["lunch"]["count"],
        "dinner_plates": report["dinner"]["count"],
        "lunch_confirmed": report["lunch"]["count"],
        "dinner_confirmed": report["dinner"]["count"],
        "lunch_capacity": cap["lunch"],
        "dinner_capacity": cap["dinner"],
        "plates_today": report["total"],
        "net_to_prepare": report["total"],
        "orders_today": len(orders_today),
        "extra_plates_today": extra_plates,
        "cancelled_today": len(cancellations_today),
        "collected_period": collected_period,
        "pending_period": pending_period,
        "outstanding_total": outstanding_total,
        "meal_requirement": meal_requirement,
        "area_customers": _area_report(db),
        "cancellations_today": cancellations_today[:15],
        "todays_meals": todays_meals[:12],
        "new_food_requests": new_food_requests,
        "new_orders": new_orders,
    }


# --------------------------------------------------------------- cancellations / demand
def _cancellation_rows(db: Session, date_from: date, date_to: date) -> list[dict]:
    """Every cancelled meal in [date_from, date_to] — a subscription skip or a
    cancelled ad-hoc order — newest first, each with its own cancellation
    timestamp and the carry-forward credit it generated."""
    out: list[dict] = []

    skip_rows = db.execute(
        select(MealSkip, Subscription, User)
        .join(Subscription, MealSkip.subscription_id == Subscription.id)
        .join(User, Subscription.user_id == User.id)
        .where(MealSkip.date >= date_from, MealSkip.date <= date_to)
    ).all()
    sub_items = {
        s.id: s
        for s in db.scalars(
            select(Subscription).options(joinedload(Subscription.menu_item))
        ).all()
    }
    for skip, sub, user in skip_rows:
        full_sub = sub_items.get(sub.id, sub)
        credit = db.scalar(
            select(MealCredit).where(
                MealCredit.user_id == user.id,
                MealCredit.meal_date == skip.date,
                MealCredit.meal_type == sub.meal_type,
                MealCredit.source_order_id.is_(None),
            )
        )
        out.append(
            {
                "id": f"skip:{skip.id}",
                "meal_date": skip.date.isoformat(),
                "weekday": WEEKDAY_NAMES[skip.date.weekday()],
                "cancelled_at": skip.created_at.isoformat() if skip.created_at else None,
                "cancelled_by": skip.created_by,
                "customer_id": user.id,
                "customer_name": user.name,
                "customer_phone": user.phone,
                "area": user.area or "-",
                "meal_type": sub.meal_type,
                "dish": full_sub.menu_item.name if full_sub.menu_item else "Kitchen's choice",
                "plates": sub.plates_per_day,
                "credit": float(credit.amount) if credit else round(float(sub.price) * sub.plates_per_day, 2),
                "source": "subscription",
            }
        )

    order_rows = db.scalars(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(
            AdHocOrder.status == "cancelled",
            AdHocOrder.date >= date_from,
            AdHocOrder.date <= date_to,
        )
    ).unique().all()
    for o in order_rows:
        user = o.user
        if user is None:
            continue
        credit = db.scalar(select(MealCredit).where(MealCredit.source_order_id == o.id))
        summary = ", ".join(f"{i.qty}× {i.item_name}" for i in o.items) or "One-off order"
        out.append(
            {
                "id": f"order:{o.id}",
                "meal_date": o.date.isoformat(),
                "weekday": WEEKDAY_NAMES[o.date.weekday()],
                "cancelled_at": o.updated_at.isoformat() if o.updated_at else None,
                "cancelled_by": credit.created_by if credit else "customer",
                "customer_id": user.id,
                "customer_name": user.name,
                "customer_phone": user.phone,
                "area": user.area or "-",
                "meal_type": o.meal_type,
                "dish": summary,
                "plates": o.total_qty,
                "credit": float(credit.amount) if credit else float(o.amount),
                "source": "order",
            }
        )

    out.sort(key=lambda r: (r["meal_date"], r["cancelled_at"] or ""), reverse=True)
    return out


def _area_report(db: Session) -> list[dict]:
    areas = db.scalars(
        select(ServiceArea).where(ServiceArea.is_active.is_(True)).order_by(ServiceArea.sort_order, ServiceArea.name)
    ).all()
    counts: dict[str, int] = {}
    for (area,) in db.execute(select(User.area)).all():
        key = (area or "").strip() or "Unassigned"
        counts[key] = counts.get(key, 0) + 1
    rows: list[dict] = []
    seen: set[str] = set()
    for a in areas:
        n = counts.get(a.name, 0)
        seen.add(a.name)
        rows.append(
            {
                "name": a.name,
                "pincode": a.pincode,
                "customers": n,
                "capacity": a.capacity,
                "pct": min(round(n / a.capacity * 100), 100) if a.capacity else 0,
            }
        )
    for name, n in counts.items():
        if name in seen or name == "Unassigned":
            continue
        rows.append({"name": name, "pincode": "", "customers": n, "capacity": 0, "pct": 0})
    if counts.get("Unassigned"):
        rows.append(
            {"name": "Unassigned", "pincode": "", "customers": counts["Unassigned"], "capacity": 0, "pct": 0}
        )
    return rows


@router.get("/cancellations")
def cancellations(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
) -> dict:
    today = clock_now(db).date()
    lo = date_from or (today - timedelta(days=30))
    hi = date_to or (today + timedelta(days=30))
    rows = _cancellation_rows(db, lo, hi)
    return {
        "date_from": lo.isoformat(),
        "date_to": hi.isoformat(),
        "total": len(rows),
        "total_credit": round(sum(r["credit"] for r in rows), 2),
        "items": rows,
    }


@router.get("/meal-demand")
def meal_demand(
    on: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
) -> dict:
    day = on or clock_now(db).date()
    report = plate_report(db, day)
    biz = settings_store.get_all(db)
    cap = {"lunch": int(biz.get("lunch_capacity") or 0), "dinner": int(biz.get("dinner_capacity") or 0)}
    meals = []
    for m in ("lunch", "dinner"):
        required = report[m]["regular_total"] + max(report[m]["adjustment_total"], 0)
        confirmed = report[m]["count"]
        meals.append(
            {
                "meal_type": m,
                "required": required,
                "confirmed": confirmed,
                "gap": required - confirmed,
                "capacity": cap[m],
                "prep": report[m]["prep"],
            }
        )
    return {
        "date": day.isoformat(),
        "weekday": report["weekday"],
        "meals": meals,
        "net_to_prepare": report["total"],
    }


@router.get("/total-meals")
def total_meals(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
) -> dict:
    today = clock_now(db).date()
    lo = date_from or today.replace(day=1)
    hi = date_to or today
    if hi < lo:
        lo, hi = hi, lo

    days: list[dict] = []
    tot_lunch = tot_dinner = tot_cancel = 0
    d = lo
    while d <= hi:
        rep = plate_report(db, d)
        cancels = sum(
            1
            for meal in ("lunch", "dinner")
            for r in rep[meal]["rows"]
            if "Cancelled" in r["notes"]
        )
        days.append(
            {
                "date": d.isoformat(),
                "weekday": rep["weekday"],
                "lunch": rep["lunch"]["count"],
                "dinner": rep["dinner"]["count"],
                "total": rep["total"],
                "cancelled": cancels,
            }
        )
        tot_lunch += rep["lunch"]["count"]
        tot_dinner += rep["dinner"]["count"]
        tot_cancel += cancels
        d += timedelta(days=1)

    return {
        "date_from": lo.isoformat(),
        "date_to": hi.isoformat(),
        "total_lunch": tot_lunch,
        "total_dinner": tot_dinner,
        "total_meals": tot_lunch + tot_dinner,
        "total_cancelled": tot_cancel,
        "days": days,
    }


@router.get("/area-report")
def area_report(db: Session = Depends(get_db)) -> dict:
    rows = _area_report(db)
    return {
        "total_customers": sum(r["customers"] for r in rows),
        "areas": rows,
    }


# --------------------------------------------------------------- settings
@router.get("/settings")
def get_settings(db: Session = Depends(get_db)) -> dict:
    return settings_store.get_all(db)


@router.put("/settings")
def put_settings(body: dict, db: Session = Depends(get_db)) -> dict:
    out = settings_store.update(db, {k: str(v) for k, v in body.items()})
    db.commit()
    return out


# --------------------------------------------------------------- plate report / kitchen
@router.get("/plate-report", response_model=PlateReport)
def plate_report_endpoint(
    on: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
) -> dict:
    target = on or clock_now(db).date()
    return plate_report(db, target)


@router.get("/plate-report/export")
def plate_report_export(
    on: date | None = Query(default=None, alias="date"),
    meal: str = Query(default="lunch"),
    db: Session = Depends(get_db),
) -> Response:
    target = on or clock_now(db).date()
    if meal not in ("lunch", "dinner"):
        raise HTTPException(422, "meal must be 'lunch' or 'dinner'")
    report = plate_report(db, target)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Food Dose Tiffin Service - kitchen list", f"{target.isoformat()} ({report['weekday']})", meal])
    w.writerow(["Customer", "Phone", "Type", "Item", "Regular", "Adjustment", "Total", "Notes"])
    for r in report[meal]["rows"]:
        w.writerow(
            [r["name"], r["phone"], r["type"], r["item_name"],
             r["regular"], r["adjustment"], r["total"], r["notes"]]
        )
    w.writerow([])
    w.writerow(["TOTAL PLATES", report[meal]["count"]])
    for p in report[meal]["prep"]:
        w.writerow(["  " + p["item_name"], p["plates"]])
    fname = f"kitchen-{meal}-{target.isoformat()}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# --------------------------------------------------------------- customers
def _customer_row(db: Session, u: User, today: date) -> dict:
    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.user_id == u.id)
    ).all()
    active = [s for s in subs if s.status == "active"]
    m_start, _ = month_bounds(today.year, today.month)
    plates_mtd = sum(
        len(served_dates(db, s, m_start, today, today)) * s.plates_per_day for s in active
    )
    lunch_qty = sum(s.plates_per_day for s in active if s.meal_type == "lunch")
    dinner_qty = sum(s.plates_per_day for s in active if s.meal_type == "dinner")
    due = (
        db.scalar(
            select(func.coalesce(func.sum(Invoice.amount - Invoice.amount_paid), 0)).where(
                Invoice.user_id == u.id, Invoice.status != "paid"
            )
        )
        or 0
    )
    return {
        "id": u.id,
        "name": u.name,
        "phone": u.phone,
        "email": u.email,
        "pincode": u.pincode,
        "address": u.address,
        "area": u.area,
        "created_at": u.created_at.isoformat(),
        "subscriptions": [SubscriptionOut.from_model(s).model_dump() for s in subs],
        "plan_summary": ", ".join(
            f"{s.meal_type.capitalize()} — {len(s.weekday_set)}d×{s.plates_per_day}" for s in active
        )
        or "—",
        "lunch_qty": lunch_qty,
        "dinner_qty": dinner_qty,
        "status": "active" if active else "inactive",
        "plates_this_month": plates_mtd,
        "amount_due": round(float(due), 2),
        "credit_balance": credits_svc.balance(db, u.id),
    }


@router.get("/customers")
def customers(
    q: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    today = clock_now(db).date()
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.name.ilike(like),
                User.phone.ilike(like),
                User.email.ilike(like),
                User.area.ilike(like),
            )
        )
    users = db.scalars(stmt.order_by(User.name)).all()
    rows = [_customer_row(db, u, today) for u in users]
    if status in ("active", "inactive"):
        rows = [r for r in rows if r["status"] == status]
    total = len(rows)
    start = (page - 1) * page_size
    return {
        "items": rows[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/customers/export")
def customers_export(
    q: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    today = clock_now(db).date()
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.name.ilike(like), User.phone.ilike(like), User.email.ilike(like), User.area.ilike(like))
        )
    users = db.scalars(stmt.order_by(User.name)).all()
    rows = [_customer_row(db, u, today) for u in users]
    if status in ("active", "inactive"):
        rows = [r for r in rows if r["status"] == status]

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Name", "Phone", "Email", "Area", "Pincode", "Plan", "Status", "Plates (MTD)", "Amount due", "Credit balance"])
    for r in rows:
        w.writerow([
            r["name"], r["phone"], r["email"], r["area"], r["pincode"], r["plan_summary"],
            r["status"], r["plates_this_month"], r["amount_due"], r["credit_balance"],
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="customers.csv"'},
    )


@router.post("/customers", status_code=201)
def create_customer(body: AdminCustomerCreate, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(User).where(User.phone == body.phone.strip())):
        raise HTTPException(409, "A customer with that phone already exists.")
    user = User(
        name=body.name.strip(),
        phone=body.phone.strip(),
        pin_hash=hash_secret(body.pin),
        email=body.email.strip(),
        pincode=body.pincode.strip(),
        address=body.address.strip(),
        area=(body.area or "").strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _customer_row(db, user, clock_now(db).date())


@router.patch("/customers/{user_id}")
def update_customer(
    user_id: int, body: AdminCustomerUpdate, db: Session = Depends(get_db)
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Customer not found")
    data = body.model_dump(exclude_unset=True)
    if "phone" in data and data["phone"]:
        clash = db.scalar(
            select(User).where(User.phone == data["phone"].strip(), User.id != user_id)
        )
        if clash:
            raise HTTPException(409, "Another customer already uses that phone.")
    if "pin" in data and data["pin"]:
        user.pin_hash = hash_secret(data.pop("pin"))
    else:
        data.pop("pin", None)
    for field, value in data.items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return _customer_row(db, user, clock_now(db).date())


def _upcoming_changes(db: Session, user_id: int, today: date) -> dict:
    subs = db.scalars(
        select(Subscription).where(Subscription.user_id == user_id)
    ).all()
    meal_of = {s.id: s.meal_type for s in subs}
    changes: list[UpcomingChange] = []

    for sk in db.scalars(
        select(MealSkip)
        .join(Subscription, MealSkip.subscription_id == Subscription.id)
        .where(Subscription.user_id == user_id, MealSkip.date >= today)
    ).all():
        m = meal_of.get(sk.subscription_id, "")
        changes.append(
            UpcomingChange(date=sk.date, meal_type=m, kind="skip",
                           label=f"{m.capitalize()} cancelled")
        )

    for o in adhoc_orders_between(db, today, today + timedelta(days=365), user_id=user_id):
        summary = ", ".join(f"{i.qty}× {i.item_name}" for i in o.items)
        changes.append(
            UpcomingChange(date=o.date, meal_type=o.meal_type, kind="order",
                           label=f"{o.meal_type.capitalize()} +{o.total_qty} plate(s): {summary}")
        )

    for s in subs:
        if s.status == "active" and s.end_date is not None and s.end_date >= today:
            changes.append(
                UpcomingChange(date=s.end_date, meal_type=s.meal_type, kind="subscription_end",
                               label=f"{s.meal_type.capitalize()} subscription ends")
            )

    changes.sort(key=lambda c: c.date)
    return {"items": [c.model_dump(mode="json") for c in changes[:12]], "total": len(changes)}


def _customer_meals(db: Session, user_id: int, start: date, end: date) -> list[dict]:
    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.user_id == user_id)
    ).all()
    skips = {s.id: skipped_dates(db, s.id) for s in subs}
    adhoc = adhoc_orders_between(db, start, end, user_id=user_id)
    rows: list[dict] = []
    d = start
    while d <= end:
        for meal in ("lunch", "dinner"):
            reg = 0
            item = ""
            skipped = False
            for s in subs:
                if s.meal_type == meal and covers(s, d):
                    reg += s.plates_per_day
                    item = s.menu_item.name if s.menu_item else "Kitchen's choice"
                    if d in skips.get(s.id, set()):
                        skipped = True
            day_orders = [o for o in adhoc if o.date == d and o.meal_type == meal]
            adj = sum(o.total_qty for o in day_orders)
            if reg == 0 and adj == 0:
                continue
            total = max((0 if skipped else reg) + adj, 0)
            status = "skipped" if skipped and adj == 0 else ("order" if reg == 0 else "scheduled")
            notes = "; ".join(
                f"+{o.total_qty} ({', '.join(f'{i.qty}× {i.item_name}' for i in o.items)})"
                for o in day_orders
            )
            rows.append(
                {
                    "date": d.isoformat(),
                    "weekday": WEEKDAY_NAMES[d.weekday()],
                    "meal_type": meal,
                    "item_name": item or (day_orders[0].items[0].item_name if day_orders else ""),
                    "regular": reg,
                    "adjustment": adj - (reg if skipped else 0),
                    "total": total,
                    "status": status,
                    "notes": notes,
                }
            )
        d += timedelta(days=1)
    return rows


@router.get("/customers/{user_id}")
def customer_profile(user_id: int, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Customer not found")
    today = clock_now(db).date()

    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.user_id == user_id)
        .order_by(Subscription.meal_type)
    ).all()
    meal_of = {s.id: s.meal_type for s in subs}
    skips = db.scalars(
        select(MealSkip)
        .join(Subscription, MealSkip.subscription_id == Subscription.id)
        .where(Subscription.user_id == user_id)
        .order_by(MealSkip.date.desc())
    ).all()
    invoices = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.user_id == user_id)
        .order_by(Invoice.period_year.desc(), Invoice.period_month.desc())
    ).unique().all()
    orders = db.scalars(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(AdHocOrder.user_id == user_id)
        .order_by(AdHocOrder.date.desc(), AdHocOrder.id.desc())
    ).unique().all()

    return {
        "customer": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "email": user.email,
            "address": user.address,
            "pincode": user.pincode,
            "area": user.area,
            "created_at": user.created_at.isoformat(),
            "credit_balance": credits_svc.balance(db, user.id),
        },
        "subscriptions": [SubscriptionOut.from_model(s).model_dump() for s in subs],
        "skips": [
            {"date": sk.date.isoformat(), "meal_type": meal_of.get(sk.subscription_id, ""), "by": sk.created_by}
            for sk in skips
        ],
        "invoices": [InvoiceOut.from_model(inv, today).model_dump(mode="json") for inv in invoices],
        "orders": [AdHocOrderOut.from_model(o).model_dump(mode="json") for o in orders],
        "meals": _customer_meals(db, user_id, today - timedelta(days=7), today + timedelta(days=14)),
        "upcoming_changes": _upcoming_changes(db, user_id, today),
    }


# --------------------------------------------------------------- subscriptions
@router.post("/customers/{user_id}/subscription", response_model=SubscriptionOut, status_code=201)
def set_subscription(
    user_id: int, body: SubscriptionCreate, db: Session = Depends(get_db)
) -> SubscriptionOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Customer not found")

    item = None
    if body.menu_item_id is not None:
        item = db.get(MenuItem, body.menu_item_id)
        if item is None:
            raise HTTPException(404, "Menu item not found")
        if item.meal_type != body.meal_type:
            raise HTTPException(422, "Menu item does not match the selected meal.")

    price = body.price
    if price is None:
        price = float(item.price) if item is not None else 0.0

    if body.end_date is not None and body.end_date < body.start_date:
        raise HTTPException(422, "end_date cannot be before start_date.")

    existing = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.meal_type == body.meal_type,
            Subscription.status != "cancelled",
        )
    )
    weekdays_csv = ",".join(str(d) for d in body.weekdays)
    if existing is not None:
        existing.menu_item_id = body.menu_item_id
        existing.weekdays = weekdays_csv
        existing.plates_per_day = body.plates_per_day
        existing.price = price
        existing.start_date = body.start_date
        existing.end_date = body.end_date
        existing.status = "active"
        sub = existing
    else:
        sub = Subscription(
            user_id=user_id,
            meal_type=body.meal_type,
            menu_item_id=body.menu_item_id,
            weekdays=weekdays_csv,
            plates_per_day=body.plates_per_day,
            price=price,
            start_date=body.start_date,
            end_date=body.end_date,
            status="active",
        )
        db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubscriptionOut.from_model(sub)


@router.get("/subscriptions")
def list_subscriptions(
    status: str | None = None,
    q: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Subscription).join(User, Subscription.user_id == User.id)
    if status and status != "all":
        stmt = stmt.where(Subscription.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.phone.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    subs = db.scalars(
        stmt.options(joinedload(Subscription.menu_item), joinedload(Subscription.user))
        .order_by(User.name, Subscription.meal_type)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return {
        "items": [SubscriptionListItem.from_model(s).model_dump() for s in subs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/subscriptions/{sub_id}", response_model=SubscriptionOut)
def update_subscription(
    sub_id: int, body: SubscriptionUpdate, db: Session = Depends(get_db)
) -> SubscriptionOut:
    sub = db.get(Subscription, sub_id)
    if sub is None:
        raise HTTPException(404, "Subscription not found")
    data = body.model_dump(exclude_unset=True)
    if "weekdays" in data and data["weekdays"] is not None:
        sub.weekdays = ",".join(str(d) for d in data.pop("weekdays"))
    for field, value in data.items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return SubscriptionOut.from_model(sub)


@router.post("/subscriptions/{sub_id}/skip", response_model=SubscriptionOut)
def admin_skip(sub_id: int, body: SkipRequest, db: Session = Depends(get_db)) -> SubscriptionOut:
    sub = db.get(Subscription, sub_id)
    if sub is None:
        raise HTTPException(404, "Subscription not found")
    if not db.scalar(
        select(MealSkip).where(MealSkip.subscription_id == sub.id, MealSkip.date == body.date)
    ):
        skip = MealSkip(subscription_id=sub.id, date=body.date, created_by="admin")
        db.add(skip)
        db.flush()
        credits_svc.issue_for_skip(db, sub, body.date, skip_id=skip.id, created_by="admin")
        db.commit()
    return SubscriptionOut.from_model(sub)


@router.delete("/subscriptions/{sub_id}/skip/{skip_date}", response_model=SubscriptionOut)
def admin_unskip(sub_id: int, skip_date: date, db: Session = Depends(get_db)) -> SubscriptionOut:
    sub = db.get(Subscription, sub_id)
    if sub is None:
        raise HTTPException(404, "Subscription not found")
    skip = db.scalar(
        select(MealSkip).where(MealSkip.subscription_id == sub.id, MealSkip.date == skip_date)
    )
    if skip is not None:
        credits_svc.void_for_skip(
            db, user_id=sub.user_id, meal_date=skip_date, meal_type=sub.meal_type
        )
        db.delete(skip)
        db.commit()
    return SubscriptionOut.from_model(sub)


# --------------------------------------------------------------- billing
@router.get("/billing")
def billing_overview(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    today = clock_now(db).date()
    year = year or today.year
    month = month or today.month

    users = db.scalars(select(User).order_by(User.name)).all()
    invoices = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.period_year == year, Invoice.period_month == month)
    ).unique().all()
    by_user = {inv.user_id: inv for inv in invoices}

    collected_total = pending_total = overdue_total = 0.0
    rows = []
    for u in users:
        inv = by_user.get(u.id)
        if inv is None:
            rows.append(
                {
                    "user_id": u.id, "name": u.name, "phone": u.phone,
                    "invoice_id": None, "plates": 0, "amount": 0.0,
                    "amount_paid": 0.0, "amount_due": 0.0, "status": "none",
                }
            )
            continue
        out = InvoiceOut.from_model(inv, today)
        collected_total += out.amount_paid
        pending_total += out.amount_due
        if out.effective_status == "overdue":
            overdue_total += out.amount_due
        rows.append(
            {
                "user_id": u.id, "name": u.name, "phone": u.phone,
                "invoice_id": inv.id, "plates": inv.plates, "amount": out.amount,
                "amount_paid": out.amount_paid, "amount_due": out.amount_due,
                "status": out.effective_status,
            }
        )
    return {
        "period_year": year,
        "period_month": month,
        "period_label": f"{year}-{month:02d}",
        "collected_total": round(collected_total, 2),
        "outstanding_total": round(pending_total, 2),
        "overdue_total": round(overdue_total, 2),
        "per_customer": rows,
    }


@router.post("/invoices/generate")
def generate_invoices(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    today = clock_now(db).date()
    year = year or today.year
    month = month or today.month
    created = 0
    for uid in db.scalars(select(User.id)).all():
        if build_invoice(db, uid, year, month, today) is not None:
            created += 1
    db.commit()
    return {"period_label": f"{year}-{month:02d}", "invoices": created}


@router.post("/invoices/{invoice_id}/mark-paid", response_model=InvoiceOut)
def admin_mark_paid(
    invoice_id: int, body: InvoicePayRequest, db: Session = Depends(get_db)
) -> InvoiceOut:
    inv = db.scalar(select(Invoice).where(Invoice.id == invoice_id))
    if inv is None:
        raise HTTPException(404, "Invoice not found")
    if inv.status == "paid":
        raise HTTPException(409, "This invoice is already paid.")
    try:
        mark_paid(db, inv, body.method, clock_now(db))
    except ValueError as e:
        raise HTTPException(402, str(e))
    db.commit()
    db.refresh(inv)
    return InvoiceOut.from_model(inv, clock_now(db).date())


@router.post("/invoices/{invoice_id}/record-payment", response_model=InvoiceOut)
def admin_record_payment(
    invoice_id: int, body: InvoiceRecordPayment, db: Session = Depends(get_db)
) -> InvoiceOut:
    inv = db.scalar(select(Invoice).where(Invoice.id == invoice_id))
    if inv is None:
        raise HTTPException(404, "Invoice not found")
    try:
        record_payment(db, inv, body.amount, body.method, clock_now(db))
    except ValueError as e:
        raise HTTPException(402, str(e))
    db.commit()
    db.refresh(inv)
    return InvoiceOut.from_model(inv, clock_now(db).date())


# --------------------------------------------------------------- demo clock
@router.get("/clock", response_model=ClockStatus)
def get_clock(db: Session = Depends(get_db)) -> ClockStatus:
    eff = clock_now(db)
    real = real_now()
    return ClockStatus(
        real_now=real,
        effective_now=eff,
        override_active=abs((eff - real).total_seconds()) > 1,
    )


@router.put("/clock", response_model=ClockStatus)
def put_clock(body: ClockOverrideIn, db: Session = Depends(get_db)) -> ClockStatus:
    set_override(db, body.simulated_now)
    db.commit()
    return get_clock(db)  # type: ignore[arg-type]
