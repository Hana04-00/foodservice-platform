"""Password/PIN hashing and JWT helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(raw: str) -> str:
    return _pwd.hash(raw)


def verify_secret(raw: str, hashed: str) -> bool:
    try:
        return _pwd.verify(raw, hashed)
    except ValueError:
        return False


def create_token(*, subject: str, role: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
