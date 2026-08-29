"""create_cart_items_table

Revision ID: d4e5f6a7b8c9
Revises: 12fc0ea00254
Create Date: 2026-08-30 01:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = '12fc0ea00254'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cart_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('merchant_id', sa.String(), nullable=False),
        sa.Column('customer_email', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('thumbnail_url', sa.String(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('merchant_id', 'customer_email', 'product_id', name='uq_cart_merchant_customer_product')
    )
    op.create_index('idx_cart_merchant_customer', 'cart_items', ['merchant_id', 'customer_email'], unique=False)
    op.create_index(op.f('ix_cart_items_merchant_id'), 'cart_items', ['merchant_id'], unique=False)
    op.create_index(op.f('ix_cart_items_customer_email'), 'cart_items', ['customer_email'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_cart_items_customer_email'), table_name='cart_items')
    op.drop_index(op.f('ix_cart_items_merchant_id'), table_name='cart_items')
    op.drop_index('idx_cart_merchant_customer', table_name='cart_items')
    op.drop_table('cart_items')
