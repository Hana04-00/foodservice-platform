"""SQLAlchemy engine / session wiring."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

_connect_args: dict = {}
if settings.database_url.startswith("sqlite"):
    # Needed for the test suite's file-backed SQLite DB shared across threads.
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
