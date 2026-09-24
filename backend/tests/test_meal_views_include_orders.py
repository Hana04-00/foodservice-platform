"""Ad-hoc (one-off) orders must feed into the same customer-facing "all my
meals" views as subscription meals: the panel dashboard stats/upcoming/
activity, meal history, and the meal calendar — not just the order-placement
page itself."""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.models import AdHocOrder, AdHocOrderItem

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)  # Wed 10 Jun 2026, 08:00


def _place(client, auth, menu_item, day, qty=1):
    r = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": day, "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": qty},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _direct_order(db, customer_id, menu_item, day, status, qty=1):
    """Insert an order straight into the DB — used for past/cancelled dates the
    customer-facing POST /orders endpoint deliberately rejects."""
    o = AdHocOrder(
        user_id=customer_id, date=day, meal_type="lunch", status=status,
        amount=float(menu_item.price) * qty,
    )
    o.items = [
        AdHocOrderItem(
            menu_item_id=menu_item.id, item_name=menu_item.name, qty=qty,
            unit_price=float(menu_item.price), line_total=float(menu_item.price) * qty,
        )
    ]
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


def test_adhoc_order_counts_in_dashboard_stats_and_upcoming(
    client, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    before = client.get("/api/v1/panel/dashboard", headers=auth).json()

    _place(client, auth, menu_item, "2026-06-15", qty=2)

    after = client.get("/api/v1/panel/dashboard", headers=auth).json()
    assert after["stats"]["total_meals"] == before["stats"]["total_meals"] + 2
    assert after["stats"]["meals_remaining"] == before["stats"]["meals_remaining"] + 2

    upcoming_orders = [u for u in after["upcoming_meals"] if u["source"] == "order"]
    assert len(upcoming_orders) == 1
    assert upcoming_orders[0]["date"] == "2026-06-15"
    assert menu_item.name in upcoming_orders[0]["dish"]


def test_adhoc_order_counts_as_consumed_when_in_the_past(client, auth, customer_id, menu_item, db, set_clock):
    set_clock(NOW)
    _direct_order(db, customer_id, menu_item, date(2026, 6, 5), "delivered", qty=3)

    d = client.get("/api/v1/panel/dashboard", headers=auth).json()
    assert d["stats"]["total_meals"] >= 3
    assert d["stats"]["meals_consumed"] >= 3

    activity_types = {a["type"] for a in d["recent_activity"] if a["source"] == "order"}
    assert "consumed" in activity_types


def test_cancelled_adhoc_order_excluded_from_dashboard_totals(
    client, auth, customer_id, menu_item, db, set_clock
):
    set_clock(NOW)
    before = client.get("/api/v1/panel/dashboard", headers=auth).json()
    _direct_order(db, customer_id, menu_item, date(2026, 6, 20), "cancelled", qty=5)

    after = client.get("/api/v1/panel/dashboard", headers=auth).json()
    assert after["stats"]["total_meals"] == before["stats"]["total_meals"]
    assert not any(u["source"] == "order" for u in after["upcoming_meals"])
    order_activity = [a for a in after["recent_activity"] if a["source"] == "order"]
    assert any(a["type"] == "cancelled" for a in order_activity)


def test_adhoc_order_appears_in_meal_history_as_upcoming(client, auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    _place(client, auth, menu_item, "2026-06-18", qty=1)

    hist = client.get("/api/v1/panel/meals/history?filter=all", headers=auth).json()
    order_rows = [r for r in hist["items"] if r["source"] == "order"]
    assert len(order_rows) == 1
    row = order_rows[0]
    assert row["date"] == "2026-06-18"
    assert row["status"] == "upcoming"
    assert row["plates"] == 1
    assert row["amount"] == menu_item.price


def test_delivered_adhoc_order_shows_consumed_in_history(client, auth, customer_id, menu_item, db, set_clock):
    set_clock(NOW)
    _direct_order(db, customer_id, menu_item, date(2026, 6, 3), "delivered", qty=2)

    hist = client.get("/api/v1/panel/meals/history?filter=consumed", headers=auth).json()
    order_rows = [r for r in hist["items"] if r["source"] == "order"]
    assert len(order_rows) == 1
    assert order_rows[0]["status"] == "consumed"
    assert hist["counts"]["consumed"] >= 1


def test_cancelled_adhoc_order_shows_in_history_cancelled_tab(
    client, auth, customer_id, menu_item, db, set_clock
):
    set_clock(NOW)
    _direct_order(db, customer_id, menu_item, date(2026, 6, 12), "cancelled", qty=1)

    hist = client.get("/api/v1/panel/meals/history?filter=cancelled", headers=auth).json()
    order_rows = [r for r in hist["items"] if r["source"] == "order"]
    assert len(order_rows) == 1
    assert order_rows[0]["status"] == "cancelled"


def test_adhoc_order_appears_on_meal_calendar_day(client, auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    _place(client, auth, menu_item, "2026-06-22", qty=1)

    cal = client.get("/api/v1/panel/meals/calendar?year=2026&month=6", headers=auth).json()
    day = next(d for d in cal["days"] if d["date"] == "2026-06-22")
    assert len(day["orders"]) == 1
    assert day["orders"][0]["meal_type"] == "lunch"
    assert day["orders"][0]["cancelled"] is False


def test_customer_can_cancel_own_upcoming_order_and_it_drops_from_totals(
    client, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    order = _place(client, auth, menu_item, "2026-06-16", qty=1)
    before = client.get("/api/v1/panel/dashboard", headers=auth).json()

    r = client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"

    after = client.get("/api/v1/panel/dashboard", headers=auth).json()
    assert after["stats"]["total_meals"] == before["stats"]["total_meals"] - 1

    # cancelling again is rejected
    r2 = client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    assert r2.status_code == 409


def test_customer_cannot_cancel_someone_elses_order(client, auth, menu_item, set_clock):
    set_clock(NOW)
    other = client.post(
        "/api/v1/auth/customer/register",
        json={
            "name": "Other Orderer", "phone": "9333300000", "pin": "1111",
            "pincode": "560003", "address": "3 Other Street",
        },
    )
    other_auth = {"Authorization": f"Bearer {other.json()['access_token']}"}
    order = _place(client, other_auth, menu_item, "2026-06-16", qty=1)

    r = client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    assert r.status_code == 404
