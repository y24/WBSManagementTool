"""add member azure devops account

Revision ID: aa1b2c3d4e5f
Revises: 8a9b0c1d2e3f
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "aa1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "8a9b0c1d2e3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.add_column(sa.Column("azure_devops_unique_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("azure_devops_display_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.drop_column("azure_devops_display_name")
        batch_op.drop_column("azure_devops_unique_name")
