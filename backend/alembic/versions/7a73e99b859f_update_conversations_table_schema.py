"""update conversations table schema

Revision ID: 7a73e99b859f
Revises: 77d5736d01fa
Create Date: 2026-08-29 10:15:03.628121

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7a73e99b859f'
down_revision: Union[str, Sequence[str], None] = '77d5736d01fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop the old table to avoid constraint and primary key conflicts
    op.drop_table('conversations')

    # Recreate with the new schema
    op.create_table('conversations',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('merchant_id', sa.String(), nullable=False),
    sa.Column('user_email', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['merchant_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversations_merchant_id'), 'conversations', ['merchant_id'], unique=False)
    op.create_index(op.f('ix_conversations_user_email'), 'conversations', ['user_email'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_conversations_user_email'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_merchant_id'), table_name='conversations')
    op.drop_table('conversations')

    # Recreate the old table shape
    op.create_table('conversations',
    sa.Column('conversation_id', sa.String(), nullable=False),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('date_created', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_auth_token', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('conversation_id')
    )

