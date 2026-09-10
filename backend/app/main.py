"""FastAPI application entrypoint. All routes are versioned under /api/v1."""
from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.clock import now as clock_now
from app.config import settings
from app.database import get_db
from app.routers import admin, auth, billing, menu, orders, subscriptions

log = logging.getLogger("gharse")

app = FastAPI(
    title="GharSe Tiffin API",
    version="2.0.0",
    description="Subscription-based home-tiffin management: plans, daily plate report, manual billing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
for r in (
    auth.router,
    menu.router,
    subscriptions.router,
    billing.router,
    admin.router,
    orders.router,
):
    app.include_router(r, prefix=API)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get(f"{API}/meta")
def meta(db: Session = Depends(get_db)) -> dict:
    """Client-facing capability flags (drives the 'demo' notices in the UI)."""
    now = clock_now(db)
    return {
        "payments": "simulated",
        "sms_otp": "disabled",
        "timezone": settings.app_timezone,
        "cutoffs": {"lunch": "10:00", "dinner": "18:00"},
        "server_now": now.isoformat(),
        "today": now.date().isoformat(),
        "tomorrow": (now.date() + timedelta(days=1)).isoformat(),
    }
