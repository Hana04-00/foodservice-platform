"""Shared FastAPI dependencies: auth guards."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token

_bearer = HTTPBearer(auto_error=False)


def _payload(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        return decode_token(creds.credentials)
    except Exception:  # jwt.PyJWTError and friends
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    data = _payload(creds)
    if data.get("role") != "customer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Customer account required")
    user = db.get(User, int(data["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    data = _payload(creds)
    if data.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return data
