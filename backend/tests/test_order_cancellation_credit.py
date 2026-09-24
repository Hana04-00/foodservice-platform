"""Bug: cancelling an ad-hoc order (via customer self-service or the admin
status dropdown) never created a carry-forward credit — the credit logic had
only ever been wired for subscription skips. Covers the fix: both cancel paths
now issue a MealCredit, keyed on the order itself (not date+meal_type) so it
can't collide with an independent subscription-skip credit on the same day."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models import MealCredit

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)  # Wed 10 Jun 2026, 08:00


def _sub(client, admin_auth, cid, item, meal="lunch", ppd=1, price=120):
    r = client.post(
        f"/api/v1/admin/customers/{cid}/subscription",
        headers=admin_auth,
        json={
            "meal_type": meal, "weekdays": [0, 1, 2, 3, 4, 5, 6], "plates_per_day": ppd,
            "menu_item_id": item.id, "price": price, "start_date": "2026-06-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_customer_cancelling_own_order_creates_credit(client, auth, customer_id, menu_item, db, set_clock):
    set_clock(NOW)
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 2},
    ).json()

    before = client.get("/api/v1/panel/credits", headers=auth).json()
    assert before["balance"] == 0.0

    r = client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    assert r.status_code == 200, r.text

    row = db.scalar(select(MealCredit).where(MealCredit.source_order_id == order["id"]))
    assert row is not None, "cancelling an order must create a MealCredit row"
    assert float(row.amount) == menu_item.price * 2
    assert row.user_id == customer_id
    assert row.status == "available"
    assert row.created_by == "customer"

    after = client.get("/api/v1/panel/credits", headers=auth).json()
    assert after["balance"] == menu_item.price * 2
    assert after["count"] == 1
    assert after["items"][0]["source"] == "order"


def test_admin_sees_the_same_credit_balance(client, auth, admin_auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 1},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)

    customers = client.get("/api/v1/admin/customers", headers=admin_auth).json()
    row = next(c for c in customers["items"] if c["id"] == customer_id)
    assert row["credit_balance"] == menu_item.price

    profile = client.get(f"/api/v1/admin/customers/{customer_id}", headers=admin_auth).json()
    assert profile["customer"]["credit_balance"] == menu_item.price


def test_order_credit_does_not_collide_with_subscription_credit_same_day(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    """A subscription skip and an ad-hoc order cancellation on the very same
    date + meal_type must each earn their own credit, not overwrite one another
    (the old date+meal_type-only idempotency key would have collided here)."""
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=100)

    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-15"})
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 1},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)

    credits = client.get("/api/v1/panel/credits", headers=auth).json()
    assert credits["count"] == 2
    assert credits["balance"] == 100.0 + float(menu_item.price)
    sources = sorted(i["source"] for i in credits["items"])
    assert sources == ["order", "subscription"]


def test_admin_cancelling_order_via_status_patch_issues_credit(
    client, admin_auth, customer_id, menu_item, db, set_clock
):
    set_clock(NOW)
    order = client.post(
        "/api/v1/admin/orders", headers=admin_auth,
        json={
            "user_id": customer_id, "date": "2026-06-15", "meal_type": "lunch",
            "items": [{"menu_item_id": menu_item.id, "qty": 1}],
        },
    ).json()

    r = client.patch(f"/api/v1/admin/orders/{order['id']}", headers=admin_auth, json={"status": "cancelled"})
    assert r.status_code == 200, r.text

    row = db.scalar(select(MealCredit).where(MealCredit.source_order_id == order["id"]))
    assert row is not None
    assert row.created_by == "admin"


def test_admin_uncancelling_order_voids_the_credit(client, admin_auth, customer_id, menu_item, db, set_clock):
    set_clock(NOW)
    order = client.post(
        "/api/v1/admin/orders", headers=admin_auth,
        json={
            "user_id": customer_id, "date": "2026-06-15", "meal_type": "lunch",
            "items": [{"menu_item_id": menu_item.id, "qty": 1}],
        },
    ).json()
    client.patch(f"/api/v1/admin/orders/{order['id']}", headers=admin_auth, json={"status": "cancelled"})
    assert db.scalar(select(MealCredit).where(MealCredit.source_order_id == order["id"])) is not None

    client.patch(f"/api/v1/admin/orders/{order['id']}", headers=admin_auth, json={"status": "confirmed"})
    assert db.scalar(select(MealCredit).where(MealCredit.source_order_id == order["id"])) is None


def test_deleting_a_cancelled_order_removes_its_credit(client, admin_auth, customer_id, menu_item, db, set_clock):
    set_clock(NOW)
    order = client.post(
        "/api/v1/admin/orders", headers=admin_auth,
        json={
            "user_id": customer_id, "date": "2026-06-15", "meal_type": "lunch",
            "items": [{"menu_item_id": menu_item.id, "qty": 1}],
        },
    ).json()
    client.patch(f"/api/v1/admin/orders/{order['id']}", headers=admin_auth, json={"status": "cancelled"})

    r = client.delete(f"/api/v1/admin/orders/{order['id']}", headers=admin_auth)
    assert r.status_code == 200, r.text
    assert db.scalar(select(MealCredit).where(MealCredit.source_order_id == order["id"])) is None


def test_cancelling_same_order_twice_does_not_double_credit(client, auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 1},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    r2 = client.delete(f"/api/v1/orders/{order['id']}", headers=auth)
    assert r2.status_code == 409

    credits = client.get("/api/v1/panel/credits", headers=auth).json()
    assert credits["count"] == 1
    assert credits["balance"] == menu_item.price
