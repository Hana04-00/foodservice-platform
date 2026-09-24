"""Customer (phone + 4-digit PIN) and fixed admin login."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Admin, User
from app.schemas import (
    AddressUpdate,
    AdminLogin,
    CustomerLogin,
    CustomerRegister,
    TokenOut,
    UserOut,
)
from app.security import create_token, hash_secret, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/customer/register", response_model=TokenOut, status_code=201)
def register_customer(body: CustomerRegister, db: Session = Depends(get_db)) -> TokenOut:
    exists = db.scalar(select(User).where(User.phone == body.phone))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered — please log in.")
    user = User(
        name=body.name.strip(),
        phone=body.phone.strip(),
        pin_hash=hash_secret(body.pin),
        email=body.email.strip(),
        pincode=body.pincode.strip(),
        address=body.address.strip(),
        area=body.area.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(subject=user.id, role="customer")
    return TokenOut(access_token=token, role="customer", user=UserOut.model_validate(user))


@router.post("/customer/login", response_model=TokenOut)
def login_customer(body: CustomerLogin, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.phone == body.phone.strip()))
    if user is None or not verify_secret(body.pin, user.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or PIN.")
    token = create_token(subject=user.id, role="customer")
    return TokenOut(access_token=token, role="customer", user=UserOut.model_validate(user))


@router.post("/admin/login", response_model=TokenOut)
def login_admin(body: AdminLogin, db: Session = Depends(get_db)) -> TokenOut:
    admin = db.scalar(select(Admin).where(Admin.username == body.username.strip()))
    ok = admin is not None and verify_secret(body.password, admin.password_hash)
    # Fallback to env credentials if the admins table has not been seeded yet.
    if not ok and body.username == settings.admin_username and body.password == settings.admin_password:
        ok = True
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong admin credentials.")
    token = create_token(subject=body.username.strip(), role="admin")
    return TokenOut(access_token=token, role="admin")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me/address", response_model=UserOut)
def update_address(
    body: AddressUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    user.address = body.address.strip()
    user.pincode = body.pincode.strip()
    user.area = body.area.strip()
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
