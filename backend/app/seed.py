"""Seed data: admin, menu, published plans, service areas, and business settings.

With SEED_MODE=full (the default), also creates demo customers, subscriptions,
a few skips, admin-entered ad-hoc orders, and generated monthly invoices
(paid / partial / overdue). With SEED_MODE=minimal, only the menu/plans/service
areas/site settings are created — the customers table is left empty and ready
for real signups.

Usage:
    python -m app.seed            # seed only if the DB looks empty
    python -m app.seed --reset    # wipe app data first, then seed
"""
from __future__ import annotations

import random
import sys
from datetime import timedelta

from sqlalchemy import delete, select

from app.clock import now as clock_now
from app.config import settings
from app.database import SessionLocal
from app.models import (
    BUSINESS_SETTING_DEFAULTS,
    Admin,
    AdHocOrder,
    AdHocOrderItem,
    AppSetting,
    Invoice,
    InvoiceLine,
    MealCredit,
    MealSkip,
    MenuItem,
    Plan,
    ServiceArea,
    Subscription,
    User,
)
from app.security import hash_secret
from app.services.invoicing import build_invoice, mark_paid, record_payment

random.seed(20260902)

MENU = [
    # meal_type, name, dishes, price, image slug — Food Dose Tiffin Service's fixed weekly menu
    ("lunch", "Monday Lunch Thali",
     ["Bhindi", "Dal", "4 Roti", "Chawal"], 110, "lunch-monday"),
    ("dinner", "Monday Dinner Thali",
     ["Baingan Bharta", "Dal", "4 Roti", "Chawal"], 110, "dinner-monday"),
    ("lunch", "Tuesday Lunch Thali",
     ["Chole", "Puri", "Sweet"], 130, "lunch-tuesday"),
    ("dinner", "Tuesday Dinner Thali",
     ["Aloo Jeera", "Dal", "4 Roti", "Chawal"], 110, "dinner-tuesday"),
    ("lunch", "Wednesday Lunch Thali",
     ["Kofta", "Dal", "4 Roti", "Chawal"], 120, "lunch-wednesday"),
    ("dinner", "Wednesday Dinner Thali",
     ["Mix Veg", "Dal", "4 Roti", "Chawal"], 110, "dinner-wednesday"),
    ("lunch", "Thursday Lunch Thali",
     ["Kadi", "Loki", "4 Roti", "Chawal"], 110, "lunch-thursday"),
    ("dinner", "Thursday Dinner Thali",
     ["Soya Keema", "Dal", "4 Roti", "Chawal"], 120, "dinner-thursday"),
    ("lunch", "Friday Lunch Thali",
     ["Rajma", "Seasonal Veg", "4 Roti", "Chawal"], 120, "lunch-friday"),
    ("dinner", "Friday Dinner Thali",
     ["Aloo Gobhi", "Dal", "4 Roti", "Chawal"], 110, "dinner-friday"),
    ("lunch", "Saturday Lunch Thali",
     ["Veg Biryani", "Raita"], 130, "lunch-saturday"),
    ("dinner", "Saturday Dinner Thali",
     ["Dal Makhani", "Kaddu", "4 Roti", "Chawal"], 130, "dinner-saturday"),
    ("lunch", "Sunday Lunch Thali",
     ["Soya Bean Aloo", "Dal", "4 Roti", "Chawal"], 120, "lunch-sunday"),
    ("dinner", "Sunday Dinner Thali",
     ["Paneer Sabji", "Dal", "4 Roti", "Chawal"], 140, "dinner-sunday"),
]

CUSTOMERS = [
    ("Aarti Sharma", "9000000001", "1234", "aarti@example.com", "110005", "12, Bank Street, Karol Bagh, New Delhi", "Karol Bagh"),
    ("Rohan Mehta", "9000000002", "1234", "rohan@example.com", "110060", "B-44, Rajinder Nagar, New Delhi", "Rajinder Nagar"),
    ("Priya Nair", "9000000003", "1234", "priya@example.com", "110008", "7B, Patel Nagar, New Delhi", "Patel Nagar"),
    ("Imran Khan", "9000000004", "1234", "imran@example.com", "110055", "Flat 302, Paharganj, New Delhi", "Paharganj"),
    ("Sneha Iyer", "9000000005", "1234", "sneha@example.com", "110012", "19, Pusa Road, New Delhi", "Pusa Road"),
]

SITE_PLANS = [
    # name, badge, meals/month, price, meal_type, description, sort
    ("Basic", "", 20, 2200, "lunch",
     "One home-style lunch on weekdays. Perfect for a light, regular routine.", 0),
    ("Standard", "Most Popular", 26, 2730, "lunch",
     "Lunch six days a week with a rotating thali menu and free carry-forward on cancellations.", 1),
    ("Premium", "", 52, 5460, "both",
     "Lunch and dinner, Monday to Saturday. Full flexibility with credits on every skipped meal.", 2),
]

SERVICE_AREAS = [
    ("Karol Bagh", "110005", 60, 0),
    ("Rajinder Nagar", "110060", 60, 1),
    ("Patel Nagar", "110008", 50, 2),
    ("Paharganj", "110055", 45, 3),
    ("Pusa Road", "110012", 40, 4),
    ("Dev Nagar", "110005", 40, 5),
]

# per-customer plan: (lunch weekdays, lunch plates/day, dinner weekdays | None, lunch item idx | None)
PLANS = [
    ([0, 1, 2, 3, 4], 1, [0, 2, 4], 0),        # Aarti: weekday lunch + Mon/Wed/Fri dinner
    ([0, 1, 2, 3, 4], 2, None, 1),             # Rohan: weekday lunch, 2 plates/day
    ([0, 1, 2, 3, 4, 5], 1, [0, 1, 2, 3, 4], 2),  # Priya: 6-day lunch + weekday dinner
    ([1, 3], 1, None, None),                   # Imran: Tue/Thu lunch, kitchen's choice
    ([0, 1, 2, 3, 4], 1, [5, 6], 3),           # Sneha: weekday lunch + weekend dinner
]


def _reset(db) -> None:
    for model in (
        AdHocOrderItem, AdHocOrder, InvoiceLine, Invoice, MealCredit, MealSkip,
        Subscription, MenuItem, Plan, ServiceArea, User, Admin, AppSetting,
    ):
        db.execute(delete(model))
    db.commit()


def _prev_month(d):
    return (d.year - 1, 12) if d.month == 1 else (d.year, d.month - 1)


def seed() -> None:
    db = SessionLocal()
    try:
        if "--reset" in sys.argv:
            _reset(db)

        minimal = settings.seed_mode.strip().lower() == "minimal"

        if db.scalar(select(MenuItem).limit(1)) and "--reset" not in sys.argv:
            print("Data already present — pass --reset to rebuild. Nothing to do.")
            return

        # --- admin -----------------------------------------------------------
        if not db.scalar(select(Admin).where(Admin.username == settings.admin_username)):
            db.add(Admin(
                username=settings.admin_username,
                password_hash=hash_secret(settings.admin_password),
            ))

        # --- menu ----------------------------------------------------------
        items: list[MenuItem] = []
        for meal, name, dishes, price, slug in MENU:
            item = MenuItem(
                meal_type=meal, name=name, dishes="\n".join(dishes), price=price,
                image_url=f"/images/{slug}.svg", is_active=True,
            )
            db.add(item)
            items.append(item)
        db.flush()
        lunch_items = [i for i in items if i.meal_type == "lunch"]
        dinner_items = [i for i in items if i.meal_type == "dinner"]

        # --- published plans + service areas + business settings ----------
        for name, badge, mpm, price, meal_type, desc, order in SITE_PLANS:
            db.add(Plan(
                name=name, badge=badge, meals_per_month=mpm, price=price,
                meal_type=meal_type, description=desc, sort_order=order, is_active=True,
            ))
        for name, pincode, cap, order in SERVICE_AREAS:
            db.add(ServiceArea(
                name=name, pincode=pincode, capacity=cap, sort_order=order, is_active=True,
            ))
        for key, value in BUSINESS_SETTING_DEFAULTS.items():
            if not db.get(AppSetting, key):
                db.add(AppSetting(key=key, value=value))
        db.flush()

        if minimal:
            db.commit()
            print(f"Seeded (minimal) {len(items)} menu items, {len(SITE_PLANS)} plans, "
                  f"{len(SERVICE_AREAS)} service areas. No demo customers or orders created.")
            print(f"Admin login: {settings.admin_username} / {settings.admin_password}")
            return

        # --- customers + subscriptions ----------------------------------
        today = clock_now(db).date()
        start = today - timedelta(days=45)  # so last month's invoice has served days
        users: list[User] = []
        subs: list[Subscription] = []
        for (name, phone, pin, email, pincode, address, area), (l_days, l_qty, d_days, l_idx) in zip(
            CUSTOMERS, PLANS
        ):
            u = User(
                name=name, phone=phone, pin_hash=hash_secret(pin), email=email,
                pincode=pincode, address=address, area=area,
            )
            db.add(u)
            db.flush()
            users.append(u)

            l_item = lunch_items[l_idx] if l_idx is not None else None
            subs.append(Subscription(
                user_id=u.id, meal_type="lunch",
                menu_item_id=l_item.id if l_item else None,
                weekdays=",".join(str(x) for x in l_days),
                plates_per_day=l_qty,
                price=float(l_item.price) if l_item else 115.0,
                start_date=start, status="active",
            ))
            if d_days is not None:
                d_item = random.choice(dinner_items)
                subs.append(Subscription(
                    user_id=u.id, meal_type="dinner", menu_item_id=d_item.id,
                    weekdays=",".join(str(x) for x in d_days),
                    plates_per_day=1, price=float(d_item.price),
                    start_date=start, status="active",
                ))
        db.add_all(subs)
        db.flush()

        # --- a few skips (past + upcoming) + the carry-forward credit each earns --
        for s in subs[:3]:
            for offset in (-9, 3):
                d = today + timedelta(days=offset)
                if d.weekday() in s.weekday_set:
                    by = "customer" if offset > 0 else "admin"
                    sk = MealSkip(subscription_id=s.id, date=d, created_by=by)
                    db.add(sk)
                    db.flush()
                    db.add(MealCredit(
                        user_id=s.user_id,
                        amount=round(float(s.price) * s.plates_per_day, 2),
                        reason="cancellation",
                        meal_date=d,
                        meal_type=s.meal_type,
                        subscription_id=s.id,
                        source_skip_id=sk.id,
                        created_by=by,
                        status="available",
                        note=f"{s.meal_type.capitalize()} on {d:%d %b %Y} cancelled",
                    ))
        db.flush()

        # --- admin-entered ad-hoc orders (2 past last month, 2 upcoming) ----
        def _order(user, when, meal, picks):
            pool = lunch_items if meal == "lunch" else dinner_items
            o = AdHocOrder(user_id=user.id, date=when, meal_type=meal, status="confirmed",
                           notes="Guests over" if when >= today else "")
            amt = 0.0
            for idx, qty in picks:
                mi = pool[idx]
                lt = round(float(mi.price) * qty, 2)
                amt += lt
                o.items.append(AdHocOrderItem(
                    menu_item_id=mi.id, item_name=mi.name, qty=qty,
                    unit_price=float(mi.price), line_total=lt,
                ))
            o.amount = round(amt, 2)
            db.add(o)

        py, pm = _prev_month(today)
        last_month_day = today.replace(day=15)
        last_month_day = (last_month_day.replace(year=py, month=pm)
                          if last_month_day.month != pm else last_month_day)
        _order(users[0], last_month_day, "lunch", [(1, 2)])
        _order(users[2], last_month_day, "dinner", [(0, 1), (2, 1)])
        _order(users[0], today + timedelta(days=2), "lunch", [(3, 1)])
        _order(users[3], today + timedelta(days=4), "dinner", [(1, 2)])
        db.flush()

        # --- monthly invoices: previous month + current month -------------
        # previous month: 2 fully paid, 1 partial, 2 left (one will read overdue)
        for i, u in enumerate(users):
            inv = build_invoice(db, u.id, py, pm, today)
            if inv is None:
                continue
            if i in (0, 2):
                mark_paid(db, inv, "cash", clock_now(db))
            elif i == 1 and float(inv.amount) > 0:
                record_payment(db, inv, round(float(inv.amount) / 2, 2), "cash", clock_now(db))
            elif i == 4 and inv.due_date is not None:
                inv.due_date = today - timedelta(days=3)  # force overdue for the demo
        # current month: generate (unpaid), so the billing screen has live data
        for u in users:
            build_invoice(db, u.id, today.year, today.month, today)
        db.commit()

        n_inv = db.scalar(select(Invoice).order_by(Invoice.id.desc()).limit(1))
        n_ord = db.scalar(select(AdHocOrder).order_by(AdHocOrder.id.desc()).limit(1))
        print(f"Seeded {len(users)} customers, {len(items)} menu items, {len(subs)} "
              f"subscriptions, {n_ord.id if n_ord else 0} ad-hoc orders, "
              f"invoices up to id {n_inv.id if n_inv else 0}.")
        print(f"Admin login: {settings.admin_username} / {settings.admin_password}")
        print("Customer logins: phone 9000000001..9000000005, PIN 1234")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
