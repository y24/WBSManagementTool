"""add azure devops sync

Revision ID: a1b2c3d4e5f6
Revises: f8b7c6d5e4a3
Create Date: 2026-05-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f8b7c6d5e4a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table_name in ("projects", "tasks", "subtasks"):
        op.add_column(
            table_name,
            sa.Column(
                "sync_to_azure_devops",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    op.create_table(
        "devops_sync_states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("work_item_id", sa.Integer(), nullable=True),
        sa.Column("last_sent_hash", sa.String(64), nullable=True),
        sa.Column("last_local_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_devops_rev", sa.Integer(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status", sa.String(50), nullable=True),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_devops_sync_entity",
        "devops_sync_states",
        ["entity_type", "entity_id"],
    )
    op.create_index(
        "ix_devops_sync_entity",
        "devops_sync_states",
        ["entity_type", "entity_id"],
    )

    op.create_table(
        "sync_locks",
        sa.Column("lock_name", sa.String(100), primary_key=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_by", sa.String(100), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sync_locks")
    op.drop_index("ix_devops_sync_entity", table_name="devops_sync_states")
    op.drop_constraint("uq_devops_sync_entity", "devops_sync_states", type_="unique")
    op.drop_table("devops_sync_states")
    for table_name in ("projects", "tasks", "subtasks"):
        op.drop_column(table_name, "sync_to_azure_devops")
