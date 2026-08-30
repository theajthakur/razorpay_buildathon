"""create_agent_orders_table

Revision ID: e912a73b8c9d
Revises: d4e5f6a7b8c9
Create Date: 2026-08-30 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e912a73b8c9d'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    agent_order_status = sa.Enum('initiated', 'merchant_order_created', 'awaiting_payment', 'payment_captured', 'failed', name='agentorderstatus')

    op.create_table(
        'agent_orders',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('merchant_id', sa.String(), nullable=False),
        sa.Column('customer_ref', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=True),
        sa.Column('items', sa.JSON(), nullable=False),
        sa.Column('merchant_order_id', sa.String(), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('order_total', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('razorpay_order_id', sa.String(), nullable=True),
        sa.Column('razorpay_payment_id', sa.String(), nullable=True),
        sa.Column('status', agent_order_status, nullable=False, server_default='initiated'),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('razorpay_order_id', name='uq_agent_orders_razorpay_order_id')
    )
    op.create_index('idx_agent_orders_merchant_customer', 'agent_orders', ['merchant_id', 'customer_ref'], unique=False)
    op.create_index(op.f('ix_agent_orders_merchant_id'), 'agent_orders', ['merchant_id'], unique=False)
    op.create_index(op.f('ix_agent_orders_merchant_order_id'), 'agent_orders', ['merchant_order_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_orders_merchant_order_id'), table_name='agent_orders')
    op.drop_index(op.f('ix_agent_orders_merchant_id'), table_name='agent_orders')
    op.drop_index('idx_agent_orders_merchant_customer', table_name='agent_orders')
    op.drop_table('agent_orders')
