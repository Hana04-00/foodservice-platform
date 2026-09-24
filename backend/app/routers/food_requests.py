"""Customer dish suggestions ("suggest a dish" inbox).

Fully separate from the fixed weekly menu (MenuItem) — this is a suggestion
inbox only. The kitchen reviews requests manually here and, if they like an
idea, adds it to the real menu themselves via the menu manager. Nothing here
ever changes what's actually being served.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import FoodRequest, User
from app.schemas import FoodRequestCreate, FoodRequestOut, FoodRequestStatusUpdate

router = APIRouter(prefix="/food-requests", tags=["food-requests"])


@router.post("", response_model=FoodRequestOut, status_code=201)
def create_food_request(
    body: FoodRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FoodRequestOut:
    req = FoodRequest(
        customer_id=user.id,
        requested_item=body.requested_item.strip(),
        notes=(body.notes or "").strip() or None,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    req.customer = user
    return FoodRequestOut.from_model(req)


admin_router = APIRouter(
    prefix="/admin/food-requests",
    tags=["admin-food-requests"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("")
def list_food_requests(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(FoodRequest)
    if status and status != "all":
        stmt = stmt.where(FoodRequest.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(joinedload(FoodRequest.customer))
        .order_by(FoodRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return {
        "items": [FoodRequestOut.from_model(r).model_dump(mode="json") for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@admin_router.patch("/{request_id}", response_model=FoodRequestOut)
def update_food_request(
    request_id: int, body: FoodRequestStatusUpdate, db: Session = Depends(get_db)
) -> FoodRequestOut:
    req = db.scalar(
        select(FoodRequest)
        .options(joinedload(FoodRequest.customer))
        .where(FoodRequest.id == request_id)
    )
    if req is None:
        raise HTTPException(404, "Food request not found")
    req.status = body.status
    db.commit()
    db.refresh(req)
    return FoodRequestOut.from_model(req)
