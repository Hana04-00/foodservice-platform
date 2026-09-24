"""meal_credits.source_order_id: let a carry-forward credit be linked to a
cancelled ad-hoc order, not just a subscription skip

Revision ID: 0006_order_credits
Revises: 0005_food_requests
Create Date: 2026-09-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_order_credits"
down_revision: Union[str, None] = "0005_food_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("meal_credits") as b:
        b.add_column(
            sa.Column(
                "source_order_id",
                sa.Integer(),
                sa.ForeignKey("ad_hoc_orders.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
    op.create_index("ix_meal_credits_source_order_id", "meal_credits", ["source_order_id"])


def downgrade() -> None:
    op.drop_index("ix_meal_credits_source_order_id", table_name="meal_credits")
    with op.batch_alter_table("meal_credits") as b:
        b.drop_column("source_order_id")
