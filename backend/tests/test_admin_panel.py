"""Admin panel: ad-hoc orders, plates/day, partial + overdue invoicing,
customer list filters, subscription list, customer profile upcoming-changes."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)  # Wed 10 Jun 2026, 08:00


def _sub(client, admin_auth, cid, item, meal="lunch", ppd=1, price=120, weekdays=(0, 1, 2, 3, 4, 5, 6)):
    r = client.post(
        f"/api/v1/admin/customers/{cid}/subscription",
        headers=admin_auth,
        json={
            "meal_type": meal, "weekdays": list(weekdays), "plates_per_day": ppd,
            "menu_item_id": item.id, "price": price, "start_date": "2026-06-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_plates_per_day_counts_in_report_and_invoice(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    _sub(client, admin_auth, customer_id, menu_item, ppd=3, price=100)

    rep = client.get("/api/v1/admin/plate-report?date=2026-06-05", headers=admin_auth).json()
    assert rep["lunch"]["count"] == 3
    assert rep["lunch"]["regular_total"] == 3

    d = client.get("/api/v1/admin/dashboard?date=2026-06-05", headers=admin_auth).json()
    assert d["lunch_plates"] == 3

    client.post("/api/v1/admin/invoices/generate?year=2026&month=6", headers=admin_auth)
    inv = client.get("/api/v1/billing/me", headers=auth).json()[0]
    # 1..10 Jun = 10 served days, ×3 plates/day
    assert inv["plates"] == 30
    assert inv["amount"] == 30 * 100


def test_adhoc_order_shows_as_adjustment_and_bills(
    client, admin_auth, auth, customer_id, menu_item, dinner_item, set_clock
):
    set_clock(NOW)
    _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=120)

    r = client.post("/api/v1/admin/orders", headers=admin_auth, json={
        "user_id": customer_id, "date": "2026-06-05", "meal_type": "lunch",
        "notes": "guests", "items": [{"menu_item_id": menu_item.id, "qty": 2}],
    })
    assert r.status_code == 201, r.text
    assert r.json()["amount"] == 240.0
    assert r.json()["total_qty"] == 2

    rep = client.get("/api/v1/admin/plate-report?date=2026-06-05", headers=admin_auth).json()
    row = next(x for x in rep["lunch"]["rows"] if x["user_id"] == customer_id)
    assert row["regular"] == 1 and row["adjustment"] == 2 and row["total"] == 3
    assert row["type"] == "both"

    d = client.get("/api/v1/admin/dashboard?date=2026-06-05", headers=admin_auth).json()
    assert d["orders_today"] == 1 and d["extra_plates_today"] == 2

    client.post("/api/v1/admin/invoices/generate?year=2026&month=6", headers=admin_auth)
    inv = client.get("/api/v1/billing/me", headers=auth).json()[0]
    kinds = sorted(ln["kind"] for ln in inv["lines"])
    assert kinds == ["adhoc", "subscription"]


def test_orders_list_filters_and_status_update(client, admin_auth, customer_id, menu_item):
    for day in ("2026-06-01", "2026-06-02"):
        client.post("/api/v1/admin/orders", headers=admin_auth, json={
            "user_id": customer_id, "date": day, "meal_type": "lunch",
            "items": [{"menu_item_id": menu_item.id, "qty": 1}],
        })
    lst = client.get("/api/v1/admin/orders?date_from=2026-06-02", headers=admin_auth).json()
    assert lst["total"] == 1 and lst["items"][0]["date"] == "2026-06-02"

    oid = lst["items"][0]["id"]
    upd = client.patch(f"/api/v1/admin/orders/{oid}", headers=admin_auth,
                       json={"status": "delivered"})
    assert upd.json()["status"] == "delivered"
    assert client.get("/api/v1/admin/orders?status=delivered", headers=admin_auth).json()["total"] == 1


def test_partial_payment_then_overdue(client, admin_auth, auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=100)
    client.post("/api/v1/admin/invoices/generate?year=2026&month=6", headers=admin_auth)
    inv = client.get("/api/v1/billing/me", headers=auth).json()[0]
    total = inv["amount"]

    r = client.post(f"/api/v1/admin/invoices/{inv['id']}/record-payment",
                    headers=admin_auth, json={"amount": total / 2, "method": "cash"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "partial"
    assert r.json()["amount_due"] == total / 2

    # jump past the due date (7 Jul) -> overdue
    set_clock(datetime(2026, 7, 20, 9, 0, tzinfo=IST))
    inv2 = client.get("/api/v1/billing/me", headers=auth).json()[0]
    assert inv2["effective_status"] == "overdue"
    assert inv2["is_overdue"] is True

    r2 = client.post(f"/api/v1/admin/invoices/{inv['id']}/record-payment",
                     headers=admin_auth, json={"amount": 9999, "method": "cash"})
    assert r2.json()["status"] == "paid"
    assert r2.json()["amount_due"] == 0


def test_customer_list_pagination_and_search(client, admin_auth):
    for i in range(3):
        client.post("/api/v1/admin/customers", headers=admin_auth, json={
            "name": f"Zeta Person {i}", "phone": f"9500000{i:03d}", "pin": "0000",
            "email": f"z{i}@ex.com",
        })
    page = client.get("/api/v1/admin/customers?page=1&page_size=2", headers=admin_auth).json()
    assert page["page_size"] == 2 and len(page["items"]) == 2 and page["total"] >= 3

    hit = client.get("/api/v1/admin/customers?q=Zeta Person 1", headers=admin_auth).json()
    assert hit["total"] == 1 and hit["items"][0]["name"] == "Zeta Person 1"

    # a brand-new customer with no subscription is "inactive"
    inact = client.get("/api/v1/admin/customers?status=inactive", headers=admin_auth).json()
    assert any(r["name"].startswith("Zeta Person") for r in inact["items"])


def test_subscriptions_list_and_status_filter(client, admin_auth, customer_id, menu_item):
    _sub(client, admin_auth, customer_id, menu_item)
    allsubs = client.get("/api/v1/admin/subscriptions", headers=admin_auth).json()
    assert allsubs["total"] >= 1
    sid = allsubs["items"][0]["id"]
    client.patch(f"/api/v1/admin/subscriptions/{sid}", headers=admin_auth,
                 json={"status": "paused"})
    paused = client.get("/api/v1/admin/subscriptions?status=paused", headers=admin_auth).json()
    assert any(s["id"] == sid for s in paused["items"])
    active = client.get("/api/v1/admin/subscriptions?status=active", headers=admin_auth).json()
    assert all(s["id"] != sid for s in active["items"])


def test_customer_profile_upcoming_changes(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item)

    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth,
                json={"date": "2026-06-12"})
    client.post("/api/v1/admin/orders", headers=admin_auth, json={
        "user_id": customer_id, "date": "2026-06-15", "meal_type": "lunch",
        "items": [{"menu_item_id": menu_item.id, "qty": 1}],
    })

    prof = client.get(f"/api/v1/admin/customers/{customer_id}", headers=admin_auth).json()
    kinds = {c["kind"] for c in prof["upcoming_changes"]["items"]}
    assert "skip" in kinds and "order" in kinds
    assert prof["customer"]["email"] == ""  # created without one
    assert len(prof["meals"]) > 0
