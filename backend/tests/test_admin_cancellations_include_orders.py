"""Bug: the admin Cancellations page (GET /admin/cancellations, and the
dashboard's cancelled_today count) only ever queried MealSkip — a cancelled
ad-hoc order (a customer with no subscription at all, only one-off orders)
never showed up there even though the cancellation and its credit were
recorded correctly. Covers the fix: _cancellation_rows now merges both
sources."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

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


def test_cancelled_order_appears_in_admin_cancellations(
    client, auth, admin_auth, customer_id, menu_item, set_clock
):
    """The exact reported scenario: a customer with NO subscription cancels a
    one-off order. It must show up in the admin Cancellations report."""
    set_clock(NOW)
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 2},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)

    canc = client.get(
        "/api/v1/admin/cancellations?date_from=2026-06-01&date_to=2026-06-30", headers=admin_auth
    ).json()
    assert canc["total"] == 1, canc
    item = canc["items"][0]
    assert item["meal_date"] == "2026-06-15"
    assert item["customer_id"] == customer_id
    assert item["source"] == "order"
    assert item["cancelled_by"] == "customer"
    assert item["cancelled_at"] is not None
    assert item["credit"] == menu_item.price * 2
    assert canc["total_credit"] == menu_item.price * 2


def test_dashboard_cancelled_today_counts_cancelled_orders(
    client, auth, admin_auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-10", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 1},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)

    d = client.get("/api/v1/admin/dashboard?date=2026-06-10", headers=admin_auth).json()
    assert d["cancelled_today"] == 1


def test_both_subscription_skip_and_order_cancellation_show_up_together(
    client, auth, admin_auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=120)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-12"})

    order = client.post(
        "/api/v1/orders",
        headers=auth,
        json={"date": "2026-06-15", "meal_type": "lunch", "menu_item_id": menu_item.id, "qty": 1},
    ).json()
    client.delete(f"/api/v1/orders/{order['id']}", headers=auth)

    canc = client.get(
        "/api/v1/admin/cancellations?date_from=2026-06-01&date_to=2026-06-30", headers=admin_auth
    ).json()
    assert canc["total"] == 2
    sources = sorted(i["source"] for i in canc["items"])
    assert sources == ["order", "subscription"]
    assert canc["total_credit"] == 120.0 + float(menu_item.price)
    # newest cancellation first
    assert canc["items"][0]["source"] == "order"
