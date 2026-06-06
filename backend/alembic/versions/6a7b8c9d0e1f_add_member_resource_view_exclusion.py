"""add member resource view exclusion

Revision ID: 6a7b8c9d0e1f
Revises: 5d6e7f8a9b0c
Create Date: 2026-06-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6a7b8c9d0e1f"
down_revision: Union[str, Sequence[str], None] = "5d6e7f8a9b0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.add_column(
            sa.Column(
                "exclude_from_resource_view",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.alter_column("exclude_from_resource_view", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.drop_column("exclude_from_resource_view")
