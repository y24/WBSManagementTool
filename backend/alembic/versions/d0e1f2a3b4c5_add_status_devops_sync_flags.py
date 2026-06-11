"""add status devops sync flags

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("mst_statuses") as batch_op:
        batch_op.add_column(
            sa.Column(
                "azure_devops_sync_ticket_id",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "azure_devops_sync_testing_id",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("mst_statuses") as batch_op:
        batch_op.drop_column("azure_devops_sync_testing_id")
        batch_op.drop_column("azure_devops_sync_ticket_id")
