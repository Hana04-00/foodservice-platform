"""Test fixtures. Uses a throwaway SQLite DB and the simulated payment gateway
with zero latency so the order/payment flow tests run fast.

SAFETY: the autouse `_clean_db` fixture below deletes every row in every table
before each test. If this suite ever ran against a real database, that would
destroy live data. To make that impossible to forget, `_require_disposable_db`
hard-fails at collection time unless DATABASE_URL is a sqlite file or a Postgres
URL whose database name contains "test" — see that function for how to point
tests at a dedicated Postgres test database instead of the default sqlite file.
"""
from __future__ import annotations

import os
import pathlib

_DEFAULT_TEST_DB_URL = "sqlite+pysqlite:///./test_gharse.db"
os.environ.setdefault("DATABASE_URL", _DEFAULT_TEST_DB_URL)
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_TIMEZONE", "Asia/Kolkata")


def _require_disposable_db(url: str) -> None:
    """Refuse to run the suite unless DATABASE_URL is obviously throwaway.

    A sqlite URL always qualifies. A Postgres (or other) URL only qualifies if
    "test" appears in it (by convention, in the database name) — e.g.
    postgresql+psycopg://tiffin:tiffin@db:5432/gharse_tiffin_test. This is what
    stops `pytest` run inside the backend container — where DATABASE_URL is
    already set to the real app database by docker-compose.yml — from silently
    wiping live data: that URL contains neither "sqlite" nor "test", so it fails
    this check instead of reaching the cleanup fixture.
    """
    low = url.lower()
    if "sqlite" in low or "test" in low:
        return
    raise RuntimeError(
        f"Refusing to run tests: DATABASE_URL={url!r} does not look like a "
        "disposable test database.\n"
        "This suite wipes every table before every test (see the autouse "
        "_clean_db fixture in tests/conftest.py) — running it against a real "
        "database would destroy live data.\n"
        "Fix: unset DATABASE_URL to use the default throwaway sqlite file "
        f"({_DEFAULT_TEST_DB_URL!r}), or set it to a Postgres database whose "
        "name contains 'test', e.g.:\n"
        "  DATABASE_URL=postgresql+psycopg://tiffin:tiffin@db:5432/gharse_tiffin_test pytest\n"
        "Inside Docker, since the backend service's DATABASE_URL points at the "
        "real app database:\n"
        "  docker compose run --rm --entrypoint '' "
        f"-e DATABASE_URL={_DEFAULT_TEST_DB_URL} backend pytest"
    )


_require_disposable_db(os.environ["DATABASE_URL"])

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

_DB_FILE = pathlib.Path("./test_gharse.db")
if _DB_FILE.exists():
    _DB_FILE.unlink()

from app.database import Base, engine, SessionLocal  # noqa: E402
from app import models  # noqa: E402,F401
from app.main import app  # noqa: E402
from app.security import hash_secret  # noqa: E402
from app.services.payments import SimulatedRazorpayGateway, set_gateway  # noqa: E402

Base.metadata.create_all(bind=engine)
set_gateway(SimulatedRazorpayGateway(latency_seconds=0))


@pytest.fixture(autouse=True)
def _clean_db():
    """Full isolation: empty every table before each test."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


@pytest.fixture()
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def menu_item(db):
    """A lunch item to order against."""
    item = models.MenuItem(
        meal_type="lunch", name="Test Rajma Thali",
        dishes="Rajma\nRice\nRoti", price=120, image_url="/images/x.png", is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture()
def dinner_item(db):
    item = models.MenuItem(
        meal_type="dinner", name="Test Khichdi Bowl",
        dishes="Khichdi\nKadhi", price=100, image_url="/images/y.png", is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture()
def customer_token(client, db):
    phone = "9111100000"
    db.query(models.User).filter_by(phone=phone).delete()
    db.commit()
    r = client.post("/api/v1/auth/customer/register", json={
        "name": "Test User", "phone": phone, "pin": "4321",
        "pincode": "560001", "address": "1 Test Street",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


@pytest.fixture()
def auth(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture()
def admin_auth(client):
    from app.config import settings

    r = client.post("/api/v1/auth/admin/login", json={
        "username": settings.admin_username, "password": settings.admin_password,
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def customer_id(customer_token, db):
    """id of the customer created by the `customer_token` fixture."""
    from sqlalchemy import select

    return db.scalar(select(models.User.id).where(models.User.phone == "9111100000"))


@pytest.fixture()
def set_clock(db):
    """Callable to set/clear the demo clock override."""
    from app.clock import set_override

    def _set(dt):
        set_override(db, dt)
        db.commit()

    yield _set
    set_override(db, None)
    db.commit()
