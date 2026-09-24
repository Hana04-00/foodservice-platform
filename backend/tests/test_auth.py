"""Customer self-registration must save an email, same as the admin-created-
customer path — the field previously existed on the schema/model but the
registration form/endpoint never collected or persisted it."""
from __future__ import annotations

from sqlalchemy import select

from app import models


def test_customer_registration_saves_email(client, db):
    r = client.post(
        "/api/v1/auth/customer/register",
        json={
            "name": "Email Test",
            "phone": "9444400000",
            "pin": "1234",
            "email": "email.test@example.com",
            "pincode": "560001",
            "address": "1 Test Street",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["user"]["email"] == "email.test@example.com"

    row = db.scalar(select(models.User).where(models.User.phone == "9444400000"))
    assert row is not None
    assert row.email == "email.test@example.com"


def test_customer_registration_email_is_optional(client):
    r = client.post(
        "/api/v1/auth/customer/register",
        json={
            "name": "No Email",
            "phone": "9444400001",
            "pin": "1234",
            "pincode": "560001",
            "address": "1 Test Street",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["user"]["email"] == ""


def test_admin_created_and_self_registered_customers_share_the_same_email_field(
    client, admin_auth
):
    """Both paths ultimately write app.models.User.email — confirm they're not
    secretly divergent fields that only coincidentally look the same in the API."""
    admin_created = client.post(
        "/api/v1/admin/customers",
        headers=admin_auth,
        json={
            "name": "Admin Made", "phone": "9444400002", "pin": "1234",
            "email": "admin.made@example.com", "pincode": "560001", "address": "x",
        },
    )
    assert admin_created.status_code == 201, admin_created.text
    assert admin_created.json()["email"] == "admin.made@example.com"

    self_registered = client.post(
        "/api/v1/auth/customer/register",
        json={
            "name": "Self Made", "phone": "9444400003", "pin": "1234",
            "email": "self.made@example.com", "pincode": "560001", "address": "x",
        },
    )
    assert self_registered.status_code == 201, self_registered.text

    customers = client.get("/api/v1/admin/customers?q=Made", headers=admin_auth).json()
    emails = {c["name"]: c["email"] for c in customers["items"]}
    assert emails == {"Admin Made": "admin.made@example.com", "Self Made": "self.made@example.com"}
