"""add member color code

Revision ID: 5d6e7f8a9b0c
Revises: b2c3d4e5f6a7
Create Date: 2026-06-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5d6e7f8a9b0c"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.add_column(sa.Column("color_code", sa.String(length=20), nullable=False, server_default="#9ca3af"))

    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.alter_column("color_code", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.drop_column("color_code")
