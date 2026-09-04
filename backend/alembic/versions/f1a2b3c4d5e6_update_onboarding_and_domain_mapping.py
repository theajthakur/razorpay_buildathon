"""update_onboarding_and_domain_mapping

Revision ID: f1a2b3c4d5e6
Revises: e912a73b8c9d
Create Date: 2026-09-04 17:35:00.000000

"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e912a73b8c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Update onboardings table
    onboarding_cols = [c['name'] for c in inspector.get_columns('onboardings')]
    if 'id' not in onboarding_cols:
        op.add_column('onboardings', sa.Column('id', sa.String(), nullable=True))
        # Populate id for any existing row
        op.execute("UPDATE onboardings SET id = user_id WHERE id IS NULL;")
        op.alter_column('onboardings', 'id', nullable=False)

    if 'slug' in onboarding_cols:
        try:
            op.drop_index('ix_onboardings_slug', table_name='onboardings')
        except Exception:
            pass
        try:
            op.drop_constraint('uq_onboardings_slug', 'onboardings', type_='unique')
        except Exception:
            pass
        op.drop_column('onboardings', 'slug')

    # 2. Update domain_mappings table
    domain_mapping_cols = [c['name'] for c in inspector.get_columns('domain_mappings')]
    if 'slug' in domain_mapping_cols:
        try:
            op.drop_index('ix_domain_mappings_slug', table_name='domain_mappings')
        except Exception:
            pass
        try:
            op.drop_constraint('domain_mappings_slug_fkey', 'domain_mappings', type_='foreignkey')
        except Exception:
            pass
        op.drop_column('domain_mappings', 'slug')

    if 'onboarding_id' not in domain_mapping_cols:
        op.add_column('domain_mappings', sa.Column('onboarding_id', sa.String(), nullable=True))
        op.create_foreign_key(
            'fk_domain_mappings_onboarding_id',
            'domain_mappings',
            'onboardings',
            ['onboarding_id'],
            ['id'],
            ondelete='CASCADE'
        )
        op.create_index('ix_domain_mappings_onboarding_id', 'domain_mappings', ['onboarding_id'], unique=False)

    if 'status' not in domain_mapping_cols:
        op.add_column('domain_mappings', sa.Column('status', sa.String(), nullable=False, server_default='PENDING'))

    if 'dns_details' not in domain_mapping_cols:
        op.add_column('domain_mappings', sa.Column('dns_details', sa.JSON(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    domain_mapping_cols = [c['name'] for c in inspector.get_columns('domain_mappings')]
    if 'dns_details' in domain_mapping_cols:
        op.drop_column('domain_mappings', 'dns_details')
    if 'status' in domain_mapping_cols:
        op.drop_column('domain_mappings', 'status')
    if 'onboarding_id' in domain_mapping_cols:
        try:
            op.drop_constraint('fk_domain_mappings_onboarding_id', 'domain_mappings', type_='foreignkey')
        except Exception:
            pass
        try:
            op.drop_index('ix_domain_mappings_onboarding_id', table_name='domain_mappings')
        except Exception:
            pass
        op.drop_column('domain_mappings', 'onboarding_id')

    op.add_column('domain_mappings', sa.Column('slug', sa.String(), nullable=True))
    op.add_column('onboardings', sa.Column('slug', sa.String(), nullable=True))
