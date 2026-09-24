"""Customer self-service ordering: POST /orders, GET /orders, and admin
visibility (GET /admin/orders, the dashboard's "new_orders" count)."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)  # Wed 10 Jun 2026, 08:00


def test_customer_can_place_order(client, auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    r = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-12", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 2},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user_id"] == customer_id
    assert body["date"] == "2026-06-12"
    assert body["meal_type"] == "lunch"
    assert body["status"] == "confirmed"
    assert body["total_qty"] == 2
    assert body["amount"] == menu_item.price * 2
    assert body["items"][0]["item_name"] == menu_item.name


def test_customer_cannot_order_past_date(client, auth, menu_item, set_clock):
    set_clock(NOW)
    r = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-01", "meal_type": "lunch", "menu_item_id": menu_item.id},
    )
    assert r.status_code == 422


def test_customer_cannot_order_mismatched_meal_type(client, auth, menu_item, set_clock):
    set_clock(NOW)
    r = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-12", "meal_type": "dinner", "menu_item_id": menu_item.id},
    )
    assert r.status_code == 422


def test_customer_order_requires_auth(client, menu_item):
    r = client.post(
        "/api/v1/orders",
        json={"date": "2026-06-12", "meal_type": "lunch", "menu_item_id": menu_item.id},
    )
    assert r.status_code == 401


def test_customer_sees_only_their_own_orders(client, auth, menu_item, set_clock):
    set_clock(NOW)
    client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-12", "meal_type": "lunch", "menu_item_id": menu_item.id},
    )

    other = client.post(
        "/api/v1/auth/customer/register",
        json={
            "name": "Other Customer", "phone": "9222200000", "pin": "5678",
            "pincode": "560002", "address": "2 Other Street",
        },
    )
    assert other.status_code == 201, other.text
    other_auth = {"Authorization": f"Bearer {other.json()['access_token']}"}
    client.post(
        "/api/v1/orders",
        headers=other_auth,
        json={"date": "2026-06-13", "meal_type": "lunch", "menu_item_id": menu_item.id},
    )

    mine = client.get("/api/v1/orders", headers=auth).json()
    assert len(mine) == 1
    assert mine[0]["date"] == "2026-06-12"

    theirs = client.get("/api/v1/orders", headers=other_auth).json()
    assert len(theirs) == 1
    assert theirs[0]["date"] == "2026-06-13"


def test_admin_sees_customer_placed_order_and_dashboard_count(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    r = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-12", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 3},
    )
    order_id = r.json()["id"]

    admin_list = client.get("/api/v1/admin/orders", headers=admin_auth).json()
    assert admin_list["total"] == 1
    row = admin_list["items"][0]
    assert row["id"] == order_id
    assert row["customer_name"] == "Test User"
    assert row["total_qty"] == 3

    d = client.get("/api/v1/admin/dashboard", headers=admin_auth).json()
    assert d["new_orders"] == 1

    client.patch(f"/api/v1/admin/orders/{order_id}", headers=admin_auth, json={"status": "delivered"})
    d2 = client.get("/api/v1/admin/dashboard", headers=admin_auth).json()
    assert d2["new_orders"] == 0
