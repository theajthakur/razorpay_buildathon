"""add_domain_mappings_and_conversations

Revision ID: 02e9b0c6085c
Revises: 862c9a174f8b
Create Date: 2026-08-28 18:27:26.214776

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02e9b0c6085c'
down_revision: Union[str, Sequence[str], None] = '862c9a174f8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add unique constraint to onboardings.slug so it can be referenced by domain_mappings.slug
    op.create_unique_constraint('uq_onboardings_slug', 'onboardings', ['slug'])

    op.create_table('conversations',
    sa.Column('conversation_id', sa.String(), nullable=False),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('date_created', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_auth_token', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('conversation_id')
    )
    op.create_table('domain_mappings',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('domain', sa.String(), nullable=False),
    sa.Column('slug', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['slug'], ['onboardings.slug'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_domain_mappings_domain'), 'domain_mappings', ['domain'], unique=True)
    op.create_index(op.f('ix_domain_mappings_slug'), 'domain_mappings', ['slug'], unique=False)

    # Seed the demo domain mapping (localhost:3001 -> ponion)
    op.execute(
        "INSERT INTO domain_mappings (id, domain, slug) "
        "VALUES ('5ff2d515-ef66-419b-ab2c-b5f76ee384a6', 'localhost:3001', 'ponion') "
        "ON CONFLICT (domain) DO NOTHING;"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_domain_mappings_slug'), table_name='domain_mappings')
    op.drop_index(op.f('ix_domain_mappings_domain'), table_name='domain_mappings')
    op.drop_table('domain_mappings')
    op.drop_table('conversations')
    op.drop_constraint('uq_onboardings_slug', 'onboardings', type_='unique')

