"""Public website data: published plans, service areas, and the public subset of
business settings (WhatsApp number, contact details, tagline)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Plan, ServiceArea
from app.services import settings_store

router = APIRouter(tags=["site"])

_PUBLIC_KEYS = (
    "business_name",
    "tagline",
    "whatsapp_number",
    "contact_phone",
    "contact_email",
    "contact_address",
    "service_hours",
    "cancellation_notice_hours",
)


@router.get("/plans")
def plans(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order, Plan.id)
    ).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "badge": p.badge,
            "meals_per_month": p.meals_per_month,
            "price": float(p.price),
            "price_per_meal": p.price_per_meal,
            "meal_type": p.meal_type,
            "description": p.description,
        }
        for p in rows
    ]


@router.get("/service-areas")
def service_areas(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(ServiceArea)
        .where(ServiceArea.is_active.is_(True))
        .order_by(ServiceArea.sort_order, ServiceArea.name)
    ).all()
    return [{"id": a.id, "name": a.name, "pincode": a.pincode} for a in rows]


@router.get("/site/settings")
def public_settings(db: Session = Depends(get_db)) -> dict:
    allv = settings_store.get_all(db)
    return {k: allv[k] for k in _PUBLIC_KEYS if k in allv}
