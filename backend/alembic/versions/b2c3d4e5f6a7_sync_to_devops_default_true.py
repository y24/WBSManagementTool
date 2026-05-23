"""sync_to_azure_devops default to true

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table_name in ("projects", "tasks", "subtasks"):
        op.alter_column(
            table_name,
            "sync_to_azure_devops",
            server_default=sa.text("true"),
        )
        op.execute(f"UPDATE {table_name} SET sync_to_azure_devops = false")


def downgrade() -> None:
    for table_name in ("projects", "tasks", "subtasks"):
        op.alter_column(
            table_name,
            "sync_to_azure_devops",
            server_default=sa.text("false"),
        )
        op.execute(
            f"UPDATE {table_name} SET sync_to_azure_devops = false"
        )
