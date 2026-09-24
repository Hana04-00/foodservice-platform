"""Admin management of ad-hoc orders: one-off itemized orders for a customer on a
specific date + meal, outside their subscription. Admin-only (list/create/update/
delete any customer's order); see app/routers/customer_orders.py for the
customer-facing self-service endpoints over the same table."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_admin
from app.models import AdHocOrder, User
from app.schemas import AdHocOrderCreate, AdHocOrderOut, AdHocOrderUpdate
from app.services import credits as credits_svc
from app.services.adhoc_orders import build_items as _build_items
from app.services.adhoc_orders import load_order as _load

router = APIRouter(
    prefix="/admin/orders", tags=["admin-orders"], dependencies=[Depends(require_admin)]
)


@router.get("")
def list_orders(
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    meal_type: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(AdHocOrder).join(User, AdHocOrder.user_id == User.id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.phone.ilike(like)))
    if date_from:
        stmt = stmt.where(AdHocOrder.date >= date_from)
    if date_to:
        stmt = stmt.where(AdHocOrder.date <= date_to)
    if status and status != "all":
        stmt = stmt.where(AdHocOrder.status == status)
    if meal_type and meal_type != "all":
        stmt = stmt.where(AdHocOrder.meal_type == meal_type)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .order_by(AdHocOrder.date.desc(), AdHocOrder.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return {
        "items": [AdHocOrderOut.from_model(o).model_dump() for o in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=AdHocOrderOut, status_code=201)
def create_order(body: AdHocOrderCreate, db: Session = Depends(get_db)) -> AdHocOrderOut:
    if db.get(User, body.user_id) is None:
        raise HTTPException(404, "Customer not found")
    items, amount = _build_items(db, body.meal_type, body.items)
    order = AdHocOrder(
        user_id=body.user_id,
        date=body.date,
        meal_type=body.meal_type,
        notes=body.notes.strip(),
        amount=amount,
        status="confirmed",
    )
    order.items = items
    db.add(order)
    db.commit()
    return AdHocOrderOut.from_model(_load(db, order.id))


@router.get("/{order_id}", response_model=AdHocOrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)) -> AdHocOrderOut:
    order = _load(db, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return AdHocOrderOut.from_model(order)


@router.patch("/{order_id}", response_model=AdHocOrderOut)
def update_order(
    order_id: int, body: AdHocOrderUpdate, db: Session = Depends(get_db)
) -> AdHocOrderOut:
    order = _load(db, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    old_status = order.status
    if body.status is not None:
        order.status = body.status
    if body.notes is not None:
        order.notes = body.notes.strip()
    if body.date is not None:
        order.date = body.date
    if body.meal_type is not None:
        order.meal_type = body.meal_type
    if body.items is not None:
        for old in list(order.items):
            db.delete(old)
        db.flush()
        items, amount = _build_items(db, body.meal_type or order.meal_type, body.items)
        order.items = items
        order.amount = amount
    db.flush()
    if body.status is not None and body.status != old_status:
        if body.status == "cancelled":
            credits_svc.issue_for_order_cancel(db, order, created_by="admin")
        elif old_status == "cancelled":
            credits_svc.void_for_order_cancel(db, order.id)
    db.commit()
    return AdHocOrderOut.from_model(_load(db, order.id))


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)) -> dict:
    order = db.get(AdHocOrder, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    credits_svc.void_for_order_cancel(db, order.id)
    db.delete(order)
    db.commit()
    return {"deleted": order_id}
