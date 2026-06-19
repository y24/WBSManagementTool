"""add shared filters table

Revision ID: b3c4d5e6f7a8
Revises: 9b0c1d2e3f4a
Create Date: 2026-06-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "9b0c1d2e3f4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "shared_filters" not in inspector.get_table_names():
        op.create_table(
            "shared_filters",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(length=100), nullable=False),
            sa.Column("filter_data", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)

    existing_indexes = {index["name"] for index in inspector.get_indexes("shared_filters")}
    if "ix_shared_filters_id" not in existing_indexes:
        op.create_index(op.f("ix_shared_filters_id"), "shared_filters", ["id"], unique=False)
    if "ix_shared_filters_token" not in existing_indexes:
        op.create_index(op.f("ix_shared_filters_token"), "shared_filters", ["token"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "shared_filters" not in inspector.get_table_names():
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("shared_filters")}
    if "ix_shared_filters_token" in existing_indexes:
        op.drop_index(op.f("ix_shared_filters_token"), table_name="shared_filters")
    if "ix_shared_filters_id" in existing_indexes:
        op.drop_index(op.f("ix_shared_filters_id"), table_name="shared_filters")
    op.drop_table("shared_filters")