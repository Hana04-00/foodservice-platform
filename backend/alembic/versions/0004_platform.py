"""platform: customer area, carry-forward credits, published plans, service areas

Revision ID: 0004_platform
Revises: 0003_admin_panel
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_platform"
down_revision: Union[str, None] = "0003_admin_panel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("area", sa.String(length=80), nullable=False, server_default=""))

    op.create_table(
        "meal_credits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("reason", sa.String(length=20), nullable=False, server_default="cancellation"),
        sa.Column("meal_date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.String(length=10), nullable=False),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=True),
        sa.Column(
            "source_skip_id",
            sa.Integer(),
            sa.ForeignKey("meal_skips.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_by", sa.String(length=10), nullable=False, server_default="customer"),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="available"),
        sa.Column("note", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_meal_credits_user_id", "meal_credits", ["user_id"])
    op.create_index("ix_meal_credits_source_skip_id", "meal_credits", ["source_skip_id"])

    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("badge", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("meals_per_month", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("meal_type", sa.String(length=10), nullable=False, server_default="lunch"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "service_areas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("pincode", sa.String(length=12), nullable=False, server_default=""),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_table("service_areas")
    op.drop_table("plans")
    op.drop_index("ix_meal_credits_source_skip_id", table_name="meal_credits")
    op.drop_index("ix_meal_credits_user_id", table_name="meal_credits")
    op.drop_table("meal_credits")
    with op.batch_alter_table("users") as b:
        b.drop_column("area")
