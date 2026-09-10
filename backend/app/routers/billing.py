"""Customer billing: view-only monthly invoice history."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.clock import now as clock_now
from app.database import get_db
from app.deps import get_current_user
from app.models import Invoice, User
from app.schemas import InvoiceOut

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/me", response_model=list[InvoiceOut])
def my_invoices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[InvoiceOut]:
    today = clock_now(db).date()
    invoices = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.user_id == user.id)
        .order_by(Invoice.period_year.desc(), Invoice.period_month.desc())
    ).unique().all()
    return [InvoiceOut.from_model(inv, today) for inv in invoices]
