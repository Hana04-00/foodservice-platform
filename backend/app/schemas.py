"""Pydantic request/response models for the REST API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

MealType = Literal["lunch", "dinner"]
SubStatus = Literal["active", "paused", "cancelled"]
PayMethod = Literal["cash", "upi", "card", "netbanking"]
AdHocStatus = Literal["confirmed", "preparing", "delivered", "cancelled"]
InvoiceStatus = Literal["pending", "partial", "paid", "overdue"]

WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ---------------------------------------------------------------- auth
class CustomerLogin(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    pin: str = Field(min_length=4, max_length=4)

    @field_validator("pin")
    @classmethod
    def _digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("PIN must be 4 digits")
        return v


class CustomerRegister(CustomerLogin):
    name: str = Field(min_length=1, max_length=120)
    pincode: str = Field(default="", max_length=12)
    address: str = Field(default="", max_length=2000)


class AdminLogin(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Optional["UserOut"] = None


# ---------------------------------------------------------------- users
class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    pincode: str
    address: str
    created_at: datetime

    class Config:
        from_attributes = True


class AddressUpdate(BaseModel):
    address: str = Field(max_length=2000)
    pincode: str = Field(default="", max_length=12)


# ---------------------------------------------------------------- menu
class MenuItemOut(BaseModel):
    id: int
    meal_type: MealType
    name: str
    dishes: list[str]
    price: float
    image_url: str
    is_active: bool

    @classmethod
    def from_model(cls, m) -> "MenuItemOut":
        return cls(
            id=m.id,
            meal_type=m.meal_type,
            name=m.name,
            dishes=m.dish_list,
            price=float(m.price),
            image_url=m.image_url,
            is_active=m.is_active,
        )


class MenuItemCreate(BaseModel):
    meal_type: MealType
    name: str = Field(min_length=1, max_length=160)
    dishes: list[str] = Field(default_factory=list)
    price: float = Field(gt=0)
    image_url: str = Field(default="", max_length=400)
    is_active: bool = True


class MenuItemUpdate(BaseModel):
    meal_type: Optional[MealType] = None
    name: Optional[str] = Field(default=None, max_length=160)
    dishes: Optional[list[str]] = None
    price: Optional[float] = Field(default=None, gt=0)
    image_url: Optional[str] = Field(default=None, max_length=400)
    is_active: Optional[bool] = None


# ---------------------------------------------------------------- subscriptions
def _clean_weekdays(v: list[int]) -> list[int]:
    cleaned = sorted({int(x) for x in v})
    if not cleaned or any(d < 0 or d > 6 for d in cleaned):
        raise ValueError("weekdays must be a non-empty list of ints 0 (Mon) .. 6 (Sun)")
    return cleaned


class SubscriptionCreate(BaseModel):
    meal_type: MealType
    weekdays: list[int] = Field(min_length=1)
    plates_per_day: int = Field(default=1, ge=1, le=20)
    menu_item_id: Optional[int] = None
    price: Optional[float] = Field(default=None, ge=0)
    start_date: date
    end_date: Optional[date] = None

    @field_validator("weekdays")
    @classmethod
    def _valid_weekdays(cls, v: list[int]) -> list[int]:
        return _clean_weekdays(v)


class SubscriptionUpdate(BaseModel):
    status: Optional[SubStatus] = None
    weekdays: Optional[list[int]] = None
    plates_per_day: Optional[int] = Field(default=None, ge=1, le=20)
    menu_item_id: Optional[int] = None
    price: Optional[float] = Field(default=None, ge=0)
    end_date: Optional[date] = None

    @field_validator("weekdays")
    @classmethod
    def _valid_weekdays(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        return None if v is None else _clean_weekdays(v)


class ScheduleDay(BaseModel):
    date: date
    weekday: str
    served: bool          # scheduled and not skipped
    skipped: bool
    locked: bool          # past the order/skip cutoff for that meal on that date


class SubscriptionOut(BaseModel):
    id: int
    meal_type: MealType
    status: SubStatus
    weekdays: list[int]
    weekday_labels: list[str]
    plates_per_day: int
    menu_item_id: Optional[int] = None
    menu_item_name: str
    image_url: str
    price: float
    start_date: date
    end_date: Optional[date] = None

    @classmethod
    def from_model(cls, s) -> "SubscriptionOut":
        wd = sorted(s.weekday_set)
        return cls(
            id=s.id,
            meal_type=s.meal_type,
            status=s.status,
            weekdays=wd,
            weekday_labels=[WEEKDAY_NAMES[d] for d in wd],
            plates_per_day=s.plates_per_day,
            menu_item_id=s.menu_item_id,
            menu_item_name=s.menu_item.name if s.menu_item else "Kitchen's choice",
            image_url=s.menu_item.image_url if s.menu_item else "",
            price=float(s.price),
            start_date=s.start_date,
            end_date=s.end_date,
        )


class SubscriptionWithSchedule(SubscriptionOut):
    schedule: list[ScheduleDay] = Field(default_factory=list)


class SubscriptionListItem(SubscriptionOut):
    customer_id: int
    customer_name: str
    customer_phone: str

    @classmethod
    def from_model(cls, s) -> "SubscriptionListItem":
        base = SubscriptionOut.from_model(s).model_dump()
        return cls(
            **base,
            customer_id=s.user_id,
            customer_name=s.user.name if s.user else "",
            customer_phone=s.user.phone if s.user else "",
        )


class SkipRequest(BaseModel):
    date: date


# ---------------------------------------------------------------- plate report
class PlateRow(BaseModel):
    user_id: int
    name: str
    phone: str
    type: Literal["subscription", "order", "both"]
    item_name: str
    regular: int
    adjustment: int
    total: int
    notes: str = ""


class PlateMeal(BaseModel):
    count: int
    regular_total: int
    adjustment_total: int
    prep: list[dict] = Field(default_factory=list)   # [{item_name, plates}]
    rows: list[PlateRow] = Field(default_factory=list)


class PlateReport(BaseModel):
    date: date
    weekday: str
    lunch: PlateMeal
    dinner: PlateMeal
    total: int


# ---------------------------------------------------------------- ad-hoc orders
class AdHocOrderItemIn(BaseModel):
    menu_item_id: int
    qty: int = Field(ge=1, le=50)


class AdHocOrderItemOut(BaseModel):
    menu_item_id: Optional[int] = None
    item_name: str
    qty: int
    unit_price: float
    line_total: float

    class Config:
        from_attributes = True


class AdHocOrderCreate(BaseModel):
    user_id: int
    date: date
    meal_type: MealType
    notes: str = Field(default="", max_length=300)
    items: list[AdHocOrderItemIn] = Field(min_length=1)


class AdHocOrderUpdate(BaseModel):
    status: Optional[AdHocStatus] = None
    notes: Optional[str] = Field(default=None, max_length=300)
    date: Optional[date] = None
    meal_type: Optional[MealType] = None
    items: Optional[list[AdHocOrderItemIn]] = None


class AdHocOrderOut(BaseModel):
    id: int
    user_id: int
    customer_name: str
    customer_phone: str
    date: date
    meal_type: MealType
    status: AdHocStatus
    notes: str
    amount: float
    total_qty: int
    items: list[AdHocOrderItemOut]
    summary: str

    @classmethod
    def from_model(cls, o) -> "AdHocOrderOut":
        items = [AdHocOrderItemOut.model_validate(i) for i in o.items]
        summary = ", ".join(f"{i.qty}× {i.item_name}" for i in items) or "—"
        return cls(
            id=o.id,
            user_id=o.user_id,
            customer_name=o.user.name if o.user else "",
            customer_phone=o.user.phone if o.user else "",
            date=o.date,
            meal_type=o.meal_type,
            status=o.status,
            notes=o.notes,
            amount=float(o.amount),
            total_qty=o.total_qty,
            items=items,
            summary=summary,
        )


# ---------------------------------------------------------------- billing / invoices
class InvoiceLineOut(BaseModel):
    kind: Literal["subscription", "adhoc"]
    meal_type: MealType
    item_name: str
    plates: int
    unit_price: float
    line_total: float

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: int
    user_id: int
    period_year: int
    period_month: int
    period_label: str
    plates: int
    amount: float
    amount_paid: float
    amount_due: float
    status: Literal["pending", "partial", "paid"]
    effective_status: InvoiceStatus
    is_overdue: bool
    due_date: Optional[date] = None
    method: Optional[str] = None
    txn_id: Optional[str] = None
    generated_at: datetime
    paid_at: Optional[datetime] = None
    lines: list[InvoiceLineOut] = Field(default_factory=list)

    @classmethod
    def from_model(cls, inv, today: Optional[date] = None) -> "InvoiceOut":
        amount = float(inv.amount)
        paid = float(inv.amount_paid)
        due = round(max(amount - paid, 0.0), 2)
        is_overdue = bool(
            inv.status != "paid"
            and inv.due_date is not None
            and today is not None
            and today > inv.due_date
        )
        effective = "overdue" if is_overdue else inv.status
        return cls(
            id=inv.id,
            user_id=inv.user_id,
            period_year=inv.period_year,
            period_month=inv.period_month,
            period_label=f"{inv.period_year}-{inv.period_month:02d}",
            plates=inv.plates,
            amount=amount,
            amount_paid=paid,
            amount_due=due,
            status=inv.status,
            effective_status=effective,
            is_overdue=is_overdue,
            due_date=inv.due_date,
            method=inv.method,
            txn_id=inv.txn_id,
            generated_at=inv.generated_at,
            paid_at=inv.paid_at,
            lines=[InvoiceLineOut.model_validate(ln) for ln in inv.lines],
        )


class InvoicePayRequest(BaseModel):
    """Settle the whole remaining balance."""

    method: PayMethod = "cash"


class InvoiceRecordPayment(BaseModel):
    amount: float = Field(gt=0)
    method: PayMethod = "cash"


# ---------------------------------------------------------------- admin
class AdminCustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    pin: str = Field(min_length=4, max_length=4)
    email: str = Field(default="", max_length=160)
    pincode: str = Field(default="", max_length=12)
    address: str = Field(default="", max_length=2000)

    @field_validator("pin")
    @classmethod
    def _digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("PIN must be 4 digits")
        return v


class AdminCustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=6, max_length=20)
    email: Optional[str] = Field(default=None, max_length=160)
    pincode: Optional[str] = Field(default=None, max_length=12)
    address: Optional[str] = Field(default=None, max_length=2000)
    pin: Optional[str] = Field(default=None, min_length=4, max_length=4)

    @field_validator("pin")
    @classmethod
    def _digits(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.isdigit():
            raise ValueError("PIN must be 4 digits")
        return v


class UpcomingChange(BaseModel):
    date: date
    meal_type: str
    kind: Literal["skip", "order", "subscription_end"]
    label: str


class ClockOverrideIn(BaseModel):
    # ISO-8601; null clears the override and returns to the real clock.
    simulated_now: Optional[datetime] = None


class ClockStatus(BaseModel):
    real_now: datetime
    effective_now: datetime
    override_active: bool


TokenOut.model_rebuild()
