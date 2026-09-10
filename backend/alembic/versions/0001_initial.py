"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("pin_hash", sa.String(length=255), nullable=False),
        sa.Column("pincode", sa.String(length=12), nullable=False, server_default=""),
        sa.Column("address", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    op.create_table(
        "admins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=60), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("dishes", sa.Text(), nullable=False, server_default=""),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("image_url", sa.String(length=400), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("delivery_type", sa.String(length=12), nullable=False, server_default="standard"),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="ordered"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "date", "meal_type", name="uq_order_user_date_meal"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_date", "orders", ["date"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False, unique=True),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="pending"),
        sa.Column("method", sa.String(length=12), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("txn_id", sa.String(length=40), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=60), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("payments")
    op.drop_index("ix_orders_date", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")
    op.drop_table("menu_items")
    op.drop_table("admins")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
