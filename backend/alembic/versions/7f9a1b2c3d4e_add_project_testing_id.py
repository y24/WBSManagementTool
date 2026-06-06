"""add project testing id

Revision ID: 7f9a1b2c3d4e
Revises: 6a7b8c9d0e1f
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f9a1b2c3d4e"
down_revision: Union[str, Sequence[str], None] = "6a7b8c9d0e1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("testing_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "testing_id")
