"""Platform additions: carry-forward credits, customer panel read models,
admin cancellations / meal-demand / settings, public plans + service areas."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 6, 10, 8, 0, tzinfo=IST)  # Wed 10 Jun 2026, 08:00 (before lunch cutoff)


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


def test_cancel_issues_carry_forward_credit_and_unskip_voids_it(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=2, price=120)

    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-10"})

    credits = client.get("/api/v1/panel/credits", headers=auth).json()
    assert credits["balance"] == 240.0  # 2 plates x 120
    assert credits["count"] == 1
    assert credits["items"][0]["meal_type"] == "lunch"
    assert credits["items"][0]["status"] == "available"

    # restore the meal -> the credit is voided
    client.delete(f"/api/v1/subscriptions/{sub['id']}/skip/2026-06-10", headers=auth)
    assert client.get("/api/v1/panel/credits", headers=auth).json()["balance"] == 0.0


def test_panel_dashboard_reports_credit_balance(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=100)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-10"})

    d = client.get("/api/v1/panel/dashboard", headers=auth).json()
    assert d["greeting"] == "Good Morning"
    assert d["stats"]["carry_forward_credit"] == 100.0
    assert d["stats"]["total_meals"] > 0
    assert any(a["type"] == "cancelled" for a in d["recent_activity"])


def test_meal_history_filters_and_columns(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=120)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-10"})

    hist = client.get("/api/v1/panel/meals/history?filter=cancelled", headers=auth).json()
    assert hist["counts"]["cancelled"] >= 1
    row = next(r for r in hist["items"] if r["date"] == "2026-06-10")
    assert row["status"] == "cancelled"
    assert row["cancelled_at"] is not None
    assert row["start_date"] == "2026-06-01"
    assert row["order_date"]  # present
    assert row["amount"] == 120.0
    assert row["credit"] == 120.0

    creds = client.get("/api/v1/panel/meals/history?filter=credits", headers=auth).json()
    assert all(r["credit"] > 0 for r in creds["items"])


def test_meal_calendar_marks_cancelled_day(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-10"})

    cal = client.get("/api/v1/panel/meals/calendar?year=2026&month=6", headers=auth).json()
    assert cal["month_label"] == "June 2026"
    day10 = next(x for x in cal["days"] if x["date"] == "2026-06-10")
    assert day10["meals"]["lunch"]["cancelled"] is True
    assert day10["meals"]["lunch"]["credit"] is True


def test_admin_cancellations_and_meal_demand(
    client, admin_auth, auth, customer_id, menu_item, set_clock
):
    set_clock(NOW)
    sub = _sub(client, admin_auth, customer_id, menu_item, ppd=1, price=120)
    client.post(f"/api/v1/subscriptions/{sub['id']}/skip", headers=auth, json={"date": "2026-06-10"})

    canc = client.get(
        "/api/v1/admin/cancellations?date_from=2026-06-01&date_to=2026-06-30", headers=admin_auth
    ).json()
    assert canc["total"] == 1
    item = canc["items"][0]
    assert item["meal_date"] == "2026-06-10"
    assert item["cancelled_at"] is not None
    assert item["credit"] == 120.0
    assert canc["total_credit"] == 120.0

    demand = client.get("/api/v1/admin/meal-demand?date=2026-06-10", headers=admin_auth).json()
    lunch = next(m for m in demand["meals"] if m["meal_type"] == "lunch")
    assert lunch["required"] == 1 and lunch["confirmed"] == 0 and lunch["gap"] == 1
    assert demand["net_to_prepare"] == 0


def test_admin_total_meals_range(client, admin_auth, customer_id, menu_item, set_clock):
    set_clock(NOW)
    _sub(client, admin_auth, customer_id, menu_item, ppd=2, price=100)
    tm = client.get(
        "/api/v1/admin/total-meals?date_from=2026-06-08&date_to=2026-06-10", headers=admin_auth
    ).json()
    assert len(tm["days"]) == 3
    assert tm["total_lunch"] == 6  # 3 days x 2 plates
    assert tm["total_meals"] == 6


def test_admin_settings_roundtrip(client, admin_auth):
    got = client.get("/api/v1/admin/settings", headers=admin_auth).json()
    assert "whatsapp_number" in got
    upd = client.put(
        "/api/v1/admin/settings", headers=admin_auth,
        json={"whatsapp_number": "919812345678", "lunch_capacity": "80"},
    ).json()
    assert upd["whatsapp_number"] == "919812345678"
    assert upd["lunch_capacity"] == "80"
    # public endpoint reflects it
    pub = client.get("/api/v1/site/settings").json()
    assert pub["whatsapp_number"] == "919812345678"
    assert "lunch_capacity" not in pub  # not a public key


def test_public_plans_and_service_areas(client, db):
    from app import models

    db.add(models.Plan(name="Standard", badge="Most Popular", meals_per_month=26,
                       price=2730, meal_type="lunch", description="x", sort_order=1))
    db.add(models.ServiceArea(name="Indiranagar", pincode="560038", capacity=60, sort_order=0))
    db.commit()

    plans = client.get("/api/v1/plans").json()
    assert plans and plans[0]["name"] == "Standard"
    assert plans[0]["price_per_meal"] == round(2730 / 26, 2)
    assert plans[0]["badge"] == "Most Popular"

    areas = client.get("/api/v1/service-areas").json()
    assert areas and areas[0]["name"] == "Indiranagar"


def test_admin_area_report_counts_customers(client, admin_auth, db):
    from app import models

    db.add(models.ServiceArea(name="Koramangala", pincode="560095", capacity=50, sort_order=0))
    db.commit()
    client.post("/api/v1/admin/customers", headers=admin_auth, json={
        "name": "Area Person", "phone": "9333300001", "pin": "0000", "area": "Koramangala",
    })
    rep = client.get("/api/v1/admin/area-report", headers=admin_auth).json()
    kora = next(a for a in rep["areas"] if a["name"] == "Koramangala")
    assert kora["customers"] == 1
    assert kora["capacity"] == 50
