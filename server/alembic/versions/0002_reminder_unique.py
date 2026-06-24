"""reminder unique constraint

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-24
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("reminder_queue") as batch_op:
        batch_op.create_unique_constraint("uq_reminder_user_taskref", ["user_id", "task_ref"])


def downgrade():
    with op.batch_alter_table("reminder_queue") as batch_op:
        batch_op.drop_constraint("uq_reminder_user_taskref")
