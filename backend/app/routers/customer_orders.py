"""Customer self-service one-off ordering: a logged-in customer browses the
menu and places an ad-hoc order — outside their subscription — for a date and
meal. Reuses the same AdHocOrder/AdHocOrderItem tables, pricing logic, and
admin visibility (plate report, billing, customer profile) as the
admin-entered orders in app/routers/orders.py."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.clock import now as clock_now
from app.database import get_db
from app.deps import get_current_user
from app.models import AdHocOrder, MenuItem, User
from app.schemas import AdHocOrderItemIn, AdHocOrderOut, CustomerOrderCreate
from app.services import credits as credits_svc
from app.services.adhoc_orders import build_items, load_order
from app.services.cutoff import CutoffError, assert_open

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[AdHocOrderOut])
def my_orders(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AdHocOrderOut]:
    rows = db.scalars(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(AdHocOrder.user_id == user.id)
        .order_by(AdHocOrder.date.desc(), AdHocOrder.id.desc())
    ).unique().all()
    return [AdHocOrderOut.from_model(o) for o in rows]


@router.post("", response_model=AdHocOrderOut, status_code=201)
def place_order(
    body: CustomerOrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AdHocOrderOut:
    today = clock_now(db).date()
    if body.date < today:
        raise HTTPException(422, "Cannot place an order for a past date.")

    item = db.get(MenuItem, body.menu_item_id)
    if item is None or not item.is_active:
        raise HTTPException(404, "Menu item not found")

    items, amount = build_items(
        db, body.meal_type, [AdHocOrderItemIn(menu_item_id=body.menu_item_id, qty=body.qty)]
    )
    order = AdHocOrder(
        user_id=user.id,
        date=body.date,
        meal_type=body.meal_type,
        notes=body.notes.strip(),
        amount=amount,
        status="confirmed",
    )
    order.items = items
    db.add(order)
    db.commit()
    return AdHocOrderOut.from_model(load_order(db, order.id))


@router.delete("/{order_id}", response_model=AdHocOrderOut)
def cancel_my_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AdHocOrderOut:
    order = load_order(db, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        raise HTTPException(409, "This order is already cancelled.")
    if order.status == "delivered":
        raise HTTPException(409, "This order has already been delivered.")

    now = clock_now(db)
    try:
        assert_open(order.meal_type, order.date, now, action="cancel")
    except CutoffError as e:
        raise HTTPException(409, str(e))

    order.status = "cancelled"
    db.flush()
    credits_svc.issue_for_order_cancel(db, order, created_by="customer")
    db.commit()
    return AdHocOrderOut.from_model(load_order(db, order.id))
