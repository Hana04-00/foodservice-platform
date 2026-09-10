"""Admin-entered ad-hoc orders: one-off itemized orders for a customer on a specific
date + meal, outside their subscription. Admin-only; no customer-facing ordering."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_admin
from app.models import AdHocOrder, AdHocOrderItem, MenuItem, User
from app.schemas import AdHocOrderCreate, AdHocOrderOut, AdHocOrderUpdate

router = APIRouter(
    prefix="/admin/orders", tags=["admin-orders"], dependencies=[Depends(require_admin)]
)


def _load(db: Session, order_id: int) -> AdHocOrder | None:
    return db.scalar(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(AdHocOrder.id == order_id)
    )


def _build_items(db: Session, meal_type: str, rows) -> tuple[list[AdHocOrderItem], float]:
    items: list[AdHocOrderItem] = []
    amount = 0.0
    for r in rows:
        mi = db.get(MenuItem, r.menu_item_id)
        if mi is None:
            raise HTTPException(404, f"Menu item {r.menu_item_id} not found")
        if mi.meal_type != meal_type:
            raise HTTPException(422, f"'{mi.name}' is not a {meal_type} item.")
        line_total = round(float(mi.price) * r.qty, 2)
        amount += line_total
        items.append(
            AdHocOrderItem(
                menu_item_id=mi.id,
                item_name=mi.name,
                qty=r.qty,
                unit_price=float(mi.price),
                line_total=line_total,
            )
        )
    return items, round(amount, 2)


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
    db.commit()
    return AdHocOrderOut.from_model(_load(db, order.id))


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)) -> dict:
    order = db.get(AdHocOrder, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    db.delete(order)
    db.commit()
    return {"deleted": order_id}
