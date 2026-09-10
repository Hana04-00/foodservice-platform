"""Monthly manual invoicing.

An invoice for (customer, year, month) bills:
  * subscription plates actually served that month = covered-and-not-skipped dates up
    to today, times the subscription's plates/day, at its snapshotted per-plate price;
  * plus every non-cancelled ad-hoc order item dated in that month (up to today).

Admin generates / refreshes invoices on demand, sets a due date, and records payments
(cash offline, or "online" through the kept simulated gateway). `overdue` is derived
from `due_date`, never stored.
"""
from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Invoice, InvoiceLine, Subscription
from app.services.payments import get_gateway
from app.services.plates import adhoc_orders_between, served_dates


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def _due_date(year: int, month: int) -> date:
    """7th of the following month."""
    nxt = date(year, month, 28) + timedelta(days=7)  # safely into next month
    return date(nxt.year, nxt.month, 7)


def _status_for(amount: float, paid: float) -> str:
    if amount > 0 and paid >= amount - 0.005:
        return "paid"
    if paid > 0:
        return "partial"
    return "pending"


def build_invoice(
    db: Session, user_id: int, year: int, month: int, today: date
) -> Invoice | None:
    """Create or refresh the customer's invoice for the month. Returns the invoice,
    or None when there is nothing to bill and no invoice exists yet. A fully-paid
    invoice is left untouched."""
    start, end = month_bounds(year, month)

    existing = db.scalar(
        select(Invoice).where(
            Invoice.user_id == user_id,
            Invoice.period_year == year,
            Invoice.period_month == month,
        )
    )
    if existing and existing.status == "paid":
        return existing

    subs = db.scalars(
        select(Subscription)
        .options(joinedload(Subscription.menu_item))
        .where(Subscription.user_id == user_id)
    ).all()

    lines: list[InvoiceLine] = []
    total_plates = 0
    total_amount = 0.0

    for s in subs:
        served = served_dates(db, s, start, end, today)
        if not served:
            continue
        unit = float(s.price)
        plates = len(served) * s.plates_per_day
        line_total = round(unit * plates, 2)
        total_plates += plates
        total_amount += line_total
        lines.append(
            InvoiceLine(
                kind="subscription",
                meal_type=s.meal_type,
                item_name=s.menu_item.name if s.menu_item else "Kitchen's choice",
                plates=plates,
                unit_price=unit,
                line_total=line_total,
            )
        )

    for o in adhoc_orders_between(db, start, min(end, today), user_id=user_id):
        for it in o.items:
            total_plates += it.qty
            total_amount += float(it.line_total)
            lines.append(
                InvoiceLine(
                    kind="adhoc",
                    meal_type=o.meal_type,
                    item_name=f"{it.item_name} ({o.date:%d %b})",
                    plates=it.qty,
                    unit_price=float(it.unit_price),
                    line_total=float(it.line_total),
                )
            )

    if not lines and existing is None:
        return None

    inv = existing or Invoice(user_id=user_id, period_year=year, period_month=month)
    inv.plates = total_plates
    inv.amount = round(total_amount, 2)
    if inv.due_date is None:
        inv.due_date = _due_date(year, month)
    inv.status = _status_for(inv.amount, float(inv.amount_paid or 0))
    if inv.status == "paid" and inv.paid_at is None:
        inv.paid_at = datetime.now()
    if existing is None:
        db.add(inv)
    else:
        for old in list(inv.lines):
            db.delete(old)
        inv.lines = []
    db.flush()
    for ln in lines:
        ln.invoice_id = inv.id
        db.add(ln)
    inv.lines = lines
    return inv


def record_payment(
    db: Session, inv: Invoice, amount: float, method: str, now: datetime
) -> Invoice:
    """Add `amount` to what has been paid on the invoice. 'cash' records an offline
    settlement; any other method routes through the simulated gateway for that amount."""
    if inv.status == "paid":
        raise ValueError("This invoice is already fully paid.")
    remaining = round(float(inv.amount) - float(inv.amount_paid or 0), 2)
    pay = round(min(amount, remaining), 2)
    if pay <= 0:
        raise ValueError("Nothing left to pay on this invoice.")

    if method == "cash":
        inv.method = "cash"
        inv.txn_id = f"cash_{inv.id}"
    else:
        result = get_gateway().charge(
            amount=pay, method=method, reference=f"invoice-{inv.id}"
        )
        if not result.ok:
            raise ValueError(result.message)
        inv.method = result.method
        inv.txn_id = result.txn_id

    inv.amount_paid = round(float(inv.amount_paid or 0) + pay, 2)
    inv.status = _status_for(float(inv.amount), float(inv.amount_paid))
    if inv.status == "paid":
        inv.paid_at = now
    return inv


def mark_paid(db: Session, inv: Invoice, method: str, now: datetime) -> Invoice:
    """Settle the whole remaining balance in one go."""
    remaining = round(float(inv.amount) - float(inv.amount_paid or 0), 2)
    return record_payment(db, inv, max(remaining, 0.01), method, now)
