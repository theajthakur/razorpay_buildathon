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
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Ensure 'slug' column exists on 'onboardings' table before creating constraint
    columns = [c['name'] for c in inspector.get_columns('onboardings')]
    if 'slug' not in columns:
        op.add_column('onboardings', sa.Column('slug', sa.String(), nullable=True))
        op.create_index(op.f('ix_onboardings_slug'), 'onboardings', ['slug'], unique=True)

    constraints = [c['name'] for c in inspector.get_unique_constraints('onboardings')]
    if 'uq_onboardings_slug' not in constraints:
        op.create_unique_constraint('uq_onboardings_slug', 'onboardings', ['slug'])

    # 2. Seed demo user & onboarding so foreign key requirement (domain_mappings.slug -> onboardings.slug) is met
    op.execute(
        "INSERT INTO users (id, email, store_name, status) "
        "VALUES ('demo_user_shopagent', 'demo@shopagent.dev', 'ShopAgent Store', 'approved') "
        "ON CONFLICT (id) DO NOTHING;"
    )
    op.execute(
        "INSERT INTO onboardings (user_id, base_url, auth_enabled, auth_disabled_ack, slug) "
        "VALUES ('demo_user_shopagent', 'https://mock.shopagent.dev', true, false, 'shopagent') "
        "ON CONFLICT (user_id) DO UPDATE SET slug = 'shopagent';"
    )

    tables = inspector.get_table_names()
    if 'conversations' not in tables:
        op.create_table('conversations',
            sa.Column('conversation_id', sa.String(), nullable=False),
            sa.Column('title', sa.String(), nullable=True),
            sa.Column('date_created', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('user_auth_token', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('conversation_id')
        )

    if 'domain_mappings' not in tables:
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

    # 3. Seed demo domain mapping
    op.execute(
        "INSERT INTO domain_mappings (id, domain, slug) "
        "VALUES ('5ff2d515-ef66-419b-ab2c-b5f76ee384a6', 'localhost:3001', 'shopagent') "
        "ON CONFLICT (domain) DO NOTHING;"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_domain_mappings_slug'), table_name='domain_mappings')
    op.drop_index(op.f('ix_domain_mappings_domain'), table_name='domain_mappings')
    op.drop_table('domain_mappings')
    op.drop_table('conversations')
    op.drop_constraint('uq_onboardings_slug', 'onboardings', type_='unique')

