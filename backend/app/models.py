"""ORM models. Schema changes are tracked via Alembic migrations, not create_all."""
from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    pin_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    pincode: Mapped[str] = mapped_column(String(12), nullable=False, default="")
    address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    area: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ad_hoc_orders: Mapped[list["AdHocOrder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    credits: Mapped[list["MealCredit"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Admin(Base):
    """Fixed admin credential, stored hashed. Seeded from ADMIN_USERNAME/PASSWORD."""

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_type: Mapped[str] = mapped_column(String(10), nullable=False)  # lunch | dinner
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    dishes: Mapped[str] = mapped_column(Text, nullable=False, default="")  # newline/comma separated
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    image_url: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @property
    def dish_list(self) -> list[str]:
        raw = self.dishes.replace("\n", ",")
        return [d.strip() for d in raw.split(",") if d.strip()]


class Subscription(Base):
    """A standing order: one meal type, on a set of weekdays, over a date window.

    `weekdays` is a CSV of ints, Monday=0 .. Sunday=6 (matches date.weekday()).
    `menu_item_id` may be NULL, meaning "kitchen's choice". `price` is the agreed
    per-plate price, snapshotted at creation so billing is stable if the menu changes.
    """

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    meal_type: Mapped[str] = mapped_column(String(10), nullable=False)  # lunch | dinner
    menu_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("menu_items.id"), nullable=True
    )
    weekdays: Mapped[str] = mapped_column(String(20), nullable=False, default="0,1,2,3,4")
    plates_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="active"
    )  # active | paused | cancelled
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="subscriptions")
    menu_item: Mapped["MenuItem | None"] = relationship()
    skips: Mapped[list["MealSkip"]] = relationship(
        back_populates="subscription", cascade="all, delete-orphan"
    )

    @property
    def weekday_set(self) -> set[int]:
        return {int(x) for x in self.weekdays.split(",") if x.strip() != ""}


class MealSkip(Base):
    """A single day the customer (or admin) opted out of an otherwise-scheduled meal."""

    __tablename__ = "meal_skips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[str] = mapped_column(String(10), nullable=False, default="customer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subscription: Mapped["Subscription"] = relationship(back_populates="skips")

    __table_args__ = (
        UniqueConstraint("subscription_id", "date", name="uq_skip_subscription_date"),
    )


class Invoice(Base):
    """A manually generated monthly bill for one customer."""

    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..12
    plates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="pending"
    )  # pending | partial | paid  (overdue is derived from due_date)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    method: Mapped[str | None] = mapped_column(String(12), nullable=True)  # cash | upi | card | netbanking
    txn_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="invoices")
    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "period_year", "period_month", name="uq_invoice_user_period"
        ),
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(12), nullable=False, default="subscription"
    )  # subscription | adhoc
    meal_type: Mapped[str] = mapped_column(String(10), nullable=False)
    item_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    plates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class AdHocOrder(Base):
    """An admin-entered one-off order for a customer on a specific date + meal.

    Not part of the subscription. Billed into that month's invoice, and shown as a
    positive adjustment on the kitchen plate report. Status tracks meal prep only.
    """

    __tablename__ = "ad_hoc_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal_type: Mapped[str] = mapped_column(String(10), nullable=False)  # lunch | dinner
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="confirmed"
    )  # confirmed | preparing | delivered | cancelled
    notes: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="ad_hoc_orders")
    items: Mapped[list["AdHocOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    @property
    def total_qty(self) -> int:
        return sum(i.qty for i in self.items)


class AdHocOrderItem(Base):
    __tablename__ = "ad_hoc_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("ad_hoc_orders.id"), nullable=False, index=True
    )
    menu_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("menu_items.id"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    order: Mapped["AdHocOrder"] = relationship(back_populates="items")


class MealCredit(Base):
    """Carry-forward credit issued to a customer when they cancel a qualifying meal
    (inside the allowed window). It is a standing balance on the account, carried
    forward to future meals. `status` is 'available' until it is spent."""

    __tablename__ = "meal_credits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    reason: Mapped[str] = mapped_column(String(20), nullable=False, default="cancellation")
    meal_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_type: Mapped[str] = mapped_column(String(10), nullable=False)  # lunch | dinner
    subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscriptions.id"), nullable=True
    )
    source_skip_id: Mapped[int | None] = mapped_column(
        ForeignKey("meal_skips.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[str] = mapped_column(String(10), nullable=False, default="customer")
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="available"
    )  # available | consumed
    note: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="credits")


class Plan(Base):
    """A published pricing plan shown on the public website (Basic / Standard /
    Premium). Display + enquiry only — subscriptions are still set per customer."""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    badge: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    meals_per_month: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    meal_type: Mapped[str] = mapped_column(
        String(10), nullable=False, default="lunch"
    )  # lunch | dinner | both
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    @property
    def price_per_meal(self) -> float:
        return round(float(self.price) / self.meals_per_month, 2) if self.meals_per_month else 0.0


class ServiceArea(Base):
    """An area the kitchen delivers to. Powers the public 'Areas We Serve' section
    and the admin area-wise customer report."""

    __tablename__ = "service_areas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    pincode: Mapped[str] = mapped_column(String(12), nullable=False, default="")
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AppSetting(Base):
    """Key/value settings row. Holds the admin 'demo clock override' among others."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# Key used by the demo clock override (see app/clock.py).
CLOCK_OVERRIDE_KEY = "demo_clock_override"

# Business settings surfaced on the public site + admin Settings screen, with defaults.
BUSINESS_SETTING_DEFAULTS: dict[str, str] = {
    "business_name": "Food Dose Tiffin Service",
    "tagline": "Home-style meals, delivered fresh every day.",
    "whatsapp_number": "919354580683",
    "contact_phone": "+91 93545 80683",
    "contact_email": "hello@fooddosetiffinservice.example",
    "contact_address": "4021/33, Reghar Pura, Block 11, Regar Pura, Karol Bagh, New Delhi, Delhi, 110005",
    "service_hours": "Open daily | Closes 9:30 PM",
    "cancellation_notice_hours": "4",
    "lunch_capacity": "60",
    "dinner_capacity": "45",
}
