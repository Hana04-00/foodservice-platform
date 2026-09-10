"""admin panel: email, plates_per_day, invoice partial/overdue fields, ad-hoc orders

Revision ID: 0003_admin_panel
Revises: 0002_subscriptions
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_admin_panel"
down_revision: Union[str, None] = "0002_subscriptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("email", sa.String(length=160), nullable=False, server_default=""))

    with op.batch_alter_table("subscriptions") as b:
        b.add_column(
            sa.Column("plates_per_day", sa.Integer(), nullable=False, server_default="1")
        )

    with op.batch_alter_table("invoices") as b:
        b.add_column(
            sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False, server_default="0")
        )
        b.add_column(sa.Column("due_date", sa.Date(), nullable=True))

    with op.batch_alter_table("invoice_lines") as b:
        b.add_column(
            sa.Column("kind", sa.String(length=12), nullable=False, server_default="subscription")
        )

    op.execute("UPDATE invoices SET status='pending' WHERE status='unpaid'")

    op.create_table(
        "ad_hoc_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="confirmed"),
        sa.Column("notes", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ad_hoc_orders_user_id", "ad_hoc_orders", ["user_id"])
    op.create_index("ix_ad_hoc_orders_date", "ad_hoc_orders", ["date"])

    op.create_table(
        "ad_hoc_order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("ad_hoc_orders.id"), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=True),
        sa.Column("item_name", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.create_index("ix_ad_hoc_order_items_order_id", "ad_hoc_order_items", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_ad_hoc_order_items_order_id", table_name="ad_hoc_order_items")
    op.drop_table("ad_hoc_order_items")
    op.drop_index("ix_ad_hoc_orders_date", table_name="ad_hoc_orders")
    op.drop_index("ix_ad_hoc_orders_user_id", table_name="ad_hoc_orders")
    op.drop_table("ad_hoc_orders")

    op.execute("UPDATE invoices SET status='unpaid' WHERE status IN ('pending','partial')")

    with op.batch_alter_table("invoice_lines") as b:
        b.drop_column("kind")
    with op.batch_alter_table("invoices") as b:
        b.drop_column("due_date")
        b.drop_column("amount_paid")
    with op.batch_alter_table("subscriptions") as b:
        b.drop_column("plates_per_day")
    with op.batch_alter_table("users") as b:
        b.drop_column("email")
