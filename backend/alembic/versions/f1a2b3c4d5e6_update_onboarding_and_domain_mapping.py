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
    # Safe PostgreSQL / SQLite DDL statements with CASCADE
    op.execute("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS id VARCHAR;")
    op.execute("UPDATE onboardings SET id = user_id WHERE id IS NULL;")

    op.execute("ALTER TABLE domain_mappings DROP COLUMN IF EXISTS slug CASCADE;")
    op.execute("ALTER TABLE onboardings DROP COLUMN IF EXISTS slug CASCADE;")

    op.execute("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS onboarding_id VARCHAR;")
    op.execute("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'PENDING';")
    op.execute("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS dns_details JSON;")


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
