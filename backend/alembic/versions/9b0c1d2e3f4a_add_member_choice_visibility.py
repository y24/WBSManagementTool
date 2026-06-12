"""add member choice visibility

Revision ID: 9b0c1d2e3f4a
Revises: f1a2b3c4d5e6
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b0c1d2e3f4a"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.add_column(
            sa.Column(
                "show_in_choices",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.alter_column("show_in_choices", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.drop_column("show_in_choices")
