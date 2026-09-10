"""subscription model: drop ad-hoc orders/payments + chatbot, add subscriptions/skips/invoices

Revision ID: 0002_subscriptions
Revises: 0001_initial
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_subscriptions"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- drop what the AI chatbot and the ad-hoc order/delivery flow used ---
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("payments")
    op.drop_index("ix_orders_date", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")

    # --- subscriptions ---
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=True),
        sa.Column("weekdays", sa.String(length=20), nullable=False, server_default="0,1,2,3,4"),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])

    # --- meal skips ---
    op.create_table(
        "meal_skips",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_by", sa.String(length=10), nullable=False, server_default="customer"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("subscription_id", "date", name="uq_skip_subscription_date"),
    )
    op.create_index("ix_meal_skips_subscription_id", "meal_skips", ["subscription_id"])

    # --- invoices ---
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=False),
        sa.Column("plates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="unpaid"),
        sa.Column("method", sa.String(length=12), nullable=True),
        sa.Column("txn_id", sa.String(length=40), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "period_year", "period_month", name="uq_invoice_user_period"),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])

    # --- invoice lines ---
    op.create_table(
        "invoice_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("item_name", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("plates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_invoice_lines_invoice_id", table_name="invoice_lines")
    op.drop_table("invoice_lines")
    op.drop_index("ix_invoices_user_id", table_name="invoices")
    op.drop_table("invoices")
    op.drop_index("ix_meal_skips_subscription_id", table_name="meal_skips")
    op.drop_table("meal_skips")
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    # --- recreate the pre-0002 order / payment / chat tables (DDL from 0001) ---
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
