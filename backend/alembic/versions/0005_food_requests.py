"""food requests: customer dish suggestions, reviewed manually by the kitchen

Revision ID: 0005_food_requests
Revises: 0004_platform
Create Date: 2026-09-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_food_requests"
down_revision: Union[str, None] = "0004_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "food_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_item", sa.String(length=160), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_food_requests_customer_id", "food_requests", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_food_requests_customer_id", table_name="food_requests")
    op.drop_table("food_requests")
