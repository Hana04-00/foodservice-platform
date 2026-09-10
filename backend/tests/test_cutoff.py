"""Cutoff logic: pure unit tests + an end-to-end check via the demo clock."""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.cutoff import CutoffError, assert_open, is_open

IST = ZoneInfo("Asia/Kolkata")


def _at(hour: int, minute: int = 0, day_offset: int = 0) -> datetime:
    base = datetime.now(IST).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base + timedelta(days=day_offset)


# --------------------------------------------------------------- unit tests
def test_lunch_open_before_10am():
    now = _at(9, 30)
    assert is_open("lunch", now.date(), now) is True


def test_lunch_closed_after_10am():
    now = _at(10, 1)
    assert is_open("lunch", now.date(), now) is False
    try:
        assert_open("lunch", now.date(), now)
        raise AssertionError("expected CutoffError")
    except CutoffError as e:
        assert "10:00" in str(e)


def test_dinner_open_before_6pm():
    now = _at(17, 59)
    assert is_open("dinner", now.date(), now) is True


def test_dinner_closed_after_6pm():
    now = _at(18, 30)
    assert is_open("dinner", now.date(), now) is False


def test_tomorrow_always_open_even_late():
    now = _at(23, 0)
    tomorrow = now.date() + timedelta(days=1)
    assert is_open("lunch", tomorrow, now) is True
    assert is_open("dinner", tomorrow, now) is True


def test_past_date_always_closed():
    now = _at(6, 0)
    yesterday = now.date() - timedelta(days=1)
    assert is_open("lunch", yesterday, now) is False
    try:
        assert_open("lunch", yesterday, now, action="cancel")
        raise AssertionError("expected CutoffError")
    except CutoffError as e:
        assert "already passed" in str(e)


# --------------------------------------------------------------- end-to-end
def _sub(client, admin_auth, customer_id, menu_item, meal="lunch"):
    r = client.post(
        f"/api/v1/admin/customers/{customer_id}/subscription",
        headers=admin_auth,
        json={
            "meal_type": meal,
            "weekdays": [0, 1, 2, 3, 4, 5, 6],
            "menu_item_id": menu_item.id,
            "price": 120,
            "start_date": "2020-01-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_api_rejects_skip_after_lunch_cutoff(
    client, db, menu_item, auth, admin_auth, customer_id, set_clock
):
    sub_id = _sub(client, admin_auth, customer_id, menu_item)
    set_clock(_at(11, 0))  # 11:00 today -> lunch is closed
    r = client.post(f"/api/v1/subscriptions/{sub_id}/skip", headers=auth,
                    json={"date": _at(11, 0).date().isoformat()})
    assert r.status_code == 409
    assert "closed at 10:00" in r.json()["detail"]


def test_api_allows_skip_before_lunch_cutoff(
    client, db, menu_item, auth, admin_auth, customer_id, set_clock
):
    sub_id = _sub(client, admin_auth, customer_id, menu_item)
    set_clock(_at(9, 0))
    r = client.post(f"/api/v1/subscriptions/{sub_id}/skip", headers=auth,
                    json={"date": _at(9, 0).date().isoformat()})
    assert r.status_code == 200, r.text
    today = _at(9, 0).date().isoformat()
    assert any(d["date"] == today and d["skipped"] for d in r.json()["schedule"])


def test_api_rejects_unskip_after_cutoff(
    client, db, dinner_item, auth, admin_auth, customer_id, set_clock
):
    sub_id = _sub(client, admin_auth, customer_id, dinner_item, meal="dinner")
    # Skip tonight's dinner early...
    set_clock(_at(9, 0))
    created = client.post(f"/api/v1/subscriptions/{sub_id}/skip", headers=auth,
                          json={"date": _at(9, 0).date().isoformat()})
    assert created.status_code == 200, created.text

    # ...then try to un-skip after 18:00.
    set_clock(_at(19, 0))
    r = client.delete(
        f"/api/v1/subscriptions/{sub_id}/skip/{_at(19, 0).date().isoformat()}",
        headers=auth,
    )
    assert r.status_code == 409
    assert "too late to restore" in r.json()["detail"]
