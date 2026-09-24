"""Shared build/load helpers for ad-hoc (one-off) orders, used by both the
admin-entered order endpoints (app/routers/orders.py) and the customer
self-service ordering endpoints (app/routers/customer_orders.py)."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import AdHocOrder, AdHocOrderItem, MenuItem


def build_items(db: Session, meal_type: str, rows) -> tuple[list[AdHocOrderItem], float]:
    """rows: an iterable of objects with .menu_item_id and .qty (e.g. AdHocOrderItemIn)."""
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


def load_order(db: Session, order_id: int) -> AdHocOrder | None:
    return db.scalar(
        select(AdHocOrder)
        .options(joinedload(AdHocOrder.items), joinedload(AdHocOrder.user))
        .where(AdHocOrder.id == order_id)
    )
