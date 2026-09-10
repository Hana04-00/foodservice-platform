"""Menu browsing (public) and management (admin)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import MenuItem
from app.schemas import MenuItemCreate, MenuItemOut, MenuItemUpdate

router = APIRouter(prefix="/menu", tags=["menu"])


def _dishes_to_text(dishes: list[str]) -> str:
    return "\n".join(d.strip() for d in dishes if d.strip())


@router.get("", response_model=list[MenuItemOut])
def list_menu(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[MenuItemOut]:
    stmt = select(MenuItem).order_by(MenuItem.meal_type, MenuItem.id)
    if not include_inactive:
        stmt = stmt.where(MenuItem.is_active.is_(True))
    return [MenuItemOut.from_model(m) for m in db.scalars(stmt)]


@router.post("", response_model=MenuItemOut, status_code=201)
def create_item(
    body: MenuItemCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> MenuItemOut:
    item = MenuItem(
        meal_type=body.meal_type,
        name=body.name.strip(),
        dishes=_dishes_to_text(body.dishes),
        price=body.price,
        image_url=body.image_url.strip(),
        is_active=body.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return MenuItemOut.from_model(item)


@router.patch("/{item_id}", response_model=MenuItemOut)
def update_item(
    item_id: int,
    body: MenuItemUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> MenuItemOut:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(404, "Menu item not found")
    data = body.model_dump(exclude_unset=True)
    if "dishes" in data and data["dishes"] is not None:
        item.dishes = _dishes_to_text(data.pop("dishes"))
    for field, value in data.items():
        if value is not None:
            setattr(item, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(item)
    return MenuItemOut.from_model(item)


@router.delete("/{item_id}", response_model=MenuItemOut)
def deactivate_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> MenuItemOut:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(404, "Menu item not found")
    item.is_active = False
    db.commit()
    db.refresh(item)
    return MenuItemOut.from_model(item)
