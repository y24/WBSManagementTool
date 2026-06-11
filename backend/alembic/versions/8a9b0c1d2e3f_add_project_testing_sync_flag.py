"""add project testing sync flag

Revision ID: 8a9b0c1d2e3f
Revises: 7f9a1b2c3d4e
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8a9b0c1d2e3f"
down_revision: Union[str, Sequence[str], None] = "7f9a1b2c3d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "sync_testing_to_azure_devops",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.execute(
        "UPDATE projects "
        "SET sync_testing_to_azure_devops = sync_to_azure_devops"
    )


def downgrade() -> None:
    op.drop_column("projects", "sync_testing_to_azure_devops")
