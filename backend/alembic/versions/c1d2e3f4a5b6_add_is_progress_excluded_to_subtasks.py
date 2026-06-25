"""Add is_progress_excluded to subtasks

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add column as nullable first
    op.add_column('subtasks', sa.Column('is_progress_excluded', sa.Boolean(), nullable=True))
    # Set default value for existing rows
    op.execute("UPDATE subtasks SET is_progress_excluded = false")
    # Now set to NOT NULL
    op.alter_column('subtasks', 'is_progress_excluded', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subtasks', 'is_progress_excluded')
