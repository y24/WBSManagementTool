"""add status azure devops state

Revision ID: c9d0e1f2a3b4
Revises: aa1b2c3d4e5f
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "aa1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("mst_statuses") as batch_op:
        batch_op.add_column(sa.Column("azure_devops_state", sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("mst_statuses") as batch_op:
        batch_op.drop_column("azure_devops_state")
