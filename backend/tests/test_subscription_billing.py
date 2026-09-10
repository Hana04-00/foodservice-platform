"""End-to-end: admin sets a subscription -> plate report reflects it -> customer
skips a meal before cutoff -> plate report + monthly invoice reflect the skip ->
invoice is settled."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

# Pinned "now": 10 Jun 2026, 08:00 — before the 10:00 lunch cutoff.
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)


def _make_sub(client, admin_auth, customer_id, menu_item, weekdays="0,1,2,3,4,5,6", price=120):
    r = client.post(
        f"/api/v1/admin/customers/{customer_id}/subscription",
        headers=admin_auth,
        json={
            "meal_type": "lunch",
            "weekdays": [int(x) for x in weekdays.split(",")],
            "menu_item_id": menu_item.id,
            "price": price,
            "start_date": "2026-06-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_admin_can_create_customer(client, admin_auth):
    r = client.post("/api/v1/admin/customers", headers=admin_auth, json={
        "name": "Fresh Customer", "phone": "9222200001", "pin": "9999",
        "pincode": "560001", "address": "1 New Road",
    })
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Fresh Customer"
    # and that customer can log in with the PIN the admin set
    login = client.post("/api/v1/auth/customer/login", json={
        "phone": "9222200001", "pin": "9999",
    })
    assert login.status_code == 200, login.text


def test_subscription_shows_in_plate_report(client, admin_auth, customer_id, menu_item):
    sub = _make_sub(client, admin_auth, customer_id, menu_item)
    assert sub["price"] == 120.0
    assert sub["menu_item_name"] == menu_item.name

    r = client.get("/api/v1/admin/plate-report?date=2026-06-05", headers=admin_auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["lunch"]["count"] == 1
    assert body["dinner"]["count"] == 0
    assert body["lunch"]["prep"][0]["plates"] == 1


def test_skip_before_cutoff_updates_plate_report(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _make_sub(client, admin_auth, customer_id, menu_item)

    # customer skips today's lunch at 08:00 (cutoff 10:00) -> allowed
    r = client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth,
                    json={"date": "2026-06-10"})
    assert r.status_code == 200, r.text

    rep = client.get("/api/v1/admin/plate-report?date=2026-06-10", headers=admin_auth).json()
    assert rep["lunch"]["count"] == 0
    row = rep["lunch"]["rows"][0]
    assert row["total"] == 0
    assert "Cancelled" in row["notes"]


def test_skip_after_cutoff_is_rejected(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _make_sub(client, admin_auth, customer_id, menu_item)
    # 5 Jun is in the past relative to the pinned clock
    r = client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth,
                    json={"date": "2026-06-05"})
    assert r.status_code == 409
    assert "already passed" in r.json()["detail"]


def test_invoice_bills_served_plates_minus_skips(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _make_sub(client, admin_auth, customer_id, menu_item, price=120)

    # skip today's lunch (served window is 1..10 Jun; skipping 10 Jun leaves 9)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth,
                json={"date": "2026-06-10"})

    gen = client.post("/api/v1/admin/invoices/generate?year=2026&month=6", headers=admin_auth)
    assert gen.status_code == 200, gen.text

    invoices = client.get("/api/v1/billing/me", headers=auth).json()
    assert len(invoices) == 1
    inv = invoices[0]
    assert inv["period_label"] == "2026-06"
    assert inv["plates"] == 9
    assert inv["amount"] == 9 * 120
    assert inv["lines"][0]["meal_type"] == "lunch"
    assert inv["lines"][0]["kind"] == "subscription"
    assert inv["status"] == "pending"
    assert inv["amount_due"] == 9 * 120

    paid = client.post(f"/api/v1/admin/invoices/{inv['id']}/mark-paid",
                       headers=admin_auth, json={"method": "cash"})
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"
    assert paid.json()["amount_due"] == 0
    assert paid.json()["txn_id"].startswith("cash_")


def test_customer_billing_is_view_only(client, auth):
    # the customer online-pay endpoint is gone
    r = client.post("/api/v1/billing/invoices/1/pay", headers=auth, json={"method": "upi"})
    assert r.status_code == 404
