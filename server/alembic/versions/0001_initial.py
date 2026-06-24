"""initial

Revision ID: 0001
Revises:
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True))
    op.create_table(
        "reminder_queue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_ref", sa.String(), nullable=False),
        sa.Column("fire_at", sa.DateTime(), nullable=False),
        sa.Column("channels", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_reminder_queue_user_id", "reminder_queue", ["user_id"])
    op.create_index("ix_reminder_queue_task_ref", "reminder_queue", ["task_ref"])
    op.create_index("ix_reminder_queue_fire_at", "reminder_queue", ["fire_at"])
    op.create_table(
        "inapp_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reminder_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_inapp_notifications_user_id", "inapp_notifications", ["user_id"])
    op.create_table(
        "research_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_table(
        "research_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("research_results")
    op.drop_table("research_jobs")
    op.drop_table("inapp_notifications")
    op.drop_table("reminder_queue")
    op.drop_table("users")
