"""Customer dish-suggestion inbox: POST /food-requests, admin listing/filtering,
PATCH status, and the "new" count surfaced on the admin dashboard."""
from __future__ import annotations


def test_customer_can_submit_food_request(client, auth, customer_id):
    r = client.post(
        "/api/v1/food-requests",
        headers=auth,
        json={"requested_item": "Chicken Biryani", "notes": "Once a month would be great"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["requested_item"] == "Chicken Biryani"
    assert body["notes"] == "Once a month would be great"
    assert body["status"] == "new"
    assert body["customer_id"] == customer_id
    assert body["customer_name"] == "Test User"


def test_food_request_notes_are_optional(client, auth):
    r = client.post(
        "/api/v1/food-requests", headers=auth, json={"requested_item": "Paneer Tikka"}
    )
    assert r.status_code == 201, r.text
    assert r.json()["notes"] is None


def test_food_request_requires_customer_auth(client):
    r = client.post("/api/v1/food-requests", json={"requested_item": "Dosa"})
    assert r.status_code == 401


def test_admin_can_list_and_filter_by_status(client, auth, admin_auth):
    client.post("/api/v1/food-requests", headers=auth, json={"requested_item": "Idli Sambhar"})
    r2 = client.post("/api/v1/food-requests", headers=auth, json={"requested_item": "Chole Bhature"})
    assert r2.status_code == 201, r2.text
    second_id = r2.json()["id"]

    client.patch(
        f"/api/v1/admin/food-requests/{second_id}", headers=admin_auth, json={"status": "declined"}
    )

    all_rows = client.get("/api/v1/admin/food-requests", headers=admin_auth).json()
    assert all_rows["total"] == 2

    new_rows = client.get("/api/v1/admin/food-requests?status=new", headers=admin_auth).json()
    assert new_rows["total"] == 1
    assert new_rows["items"][0]["requested_item"] == "Idli Sambhar"

    declined_rows = client.get(
        "/api/v1/admin/food-requests?status=declined", headers=admin_auth
    ).json()
    assert declined_rows["total"] == 1
    assert declined_rows["items"][0]["requested_item"] == "Chole Bhature"


def test_admin_can_update_food_request_status(client, auth, admin_auth):
    created = client.post(
        "/api/v1/food-requests", headers=auth, json={"requested_item": "Pav Bhaji"}
    ).json()

    r = client.patch(
        f"/api/v1/admin/food-requests/{created['id']}",
        headers=admin_auth,
        json={"status": "added_to_menu"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "added_to_menu"

    r404 = client.patch(
        "/api/v1/admin/food-requests/999999", headers=admin_auth, json={"status": "reviewed"}
    )
    assert r404.status_code == 404


def test_dashboard_reports_new_food_request_count(client, auth, admin_auth):
    r1 = client.post(
        "/api/v1/food-requests", headers=auth, json={"requested_item": "Litti Chokha"}
    ).json()
    client.post("/api/v1/food-requests", headers=auth, json={"requested_item": "Sarson da Saag"})

    d = client.get("/api/v1/admin/dashboard", headers=admin_auth).json()
    assert d["new_food_requests"] == 2

    client.patch(
        f"/api/v1/admin/food-requests/{r1['id']}", headers=admin_auth, json={"status": "reviewed"}
    )
    d2 = client.get("/api/v1/admin/dashboard", headers=admin_auth).json()
    assert d2["new_food_requests"] == 1
