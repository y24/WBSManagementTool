"""expand link_url length

Revision ID: f8b7c6d5e4a3
Revises: 2c6ce77ff281
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f8b7c6d5e4a3"
down_revision: Union[str, Sequence[str], None] = "2c6ce77ff281"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    for table_name in ("projects", "tasks", "subtasks"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column(
                "link_url",
                existing_type=sa.String(length=500),
                type_=sa.Text(),
                existing_nullable=True,
            )


def downgrade() -> None:
    """Downgrade schema."""
    for table_name in ("projects", "tasks", "subtasks"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column(
                "link_url",
                existing_type=sa.Text(),
                type_=sa.String(length=500),
                existing_nullable=True,
            )
