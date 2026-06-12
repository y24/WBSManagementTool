"""add member resource view mode

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.add_column(
            sa.Column(
                "resource_view_mode",
                sa.String(length=30),
                nullable=False,
                server_default="visible",
            )
        )

    op.execute(
        "UPDATE mst_members "
        "SET resource_view_mode = 'hidden' "
        "WHERE exclude_from_resource_view = true"
    )

    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.create_check_constraint(
            "check_member_resource_view_mode",
            "resource_view_mode IN ('visible', 'load_rate_off', 'hidden')",
        )
        batch_op.alter_column("resource_view_mode", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "UPDATE mst_members "
        "SET exclude_from_resource_view = true "
        "WHERE resource_view_mode = 'hidden'"
    )

    with op.batch_alter_table("mst_members") as batch_op:
        batch_op.drop_constraint("check_member_resource_view_mode", type_="check")
        batch_op.drop_column("resource_view_mode")
