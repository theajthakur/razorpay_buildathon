"""add_branding_and_webhook_columns

Revision ID: 862c9a174f8b
Revises: 796e8733b722
Create Date: 2026-08-24 23:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '862c9a174f8b'
down_revision: Union[str, Sequence[str], None] = '796e8733b722'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('onboardings', sa.Column('branding_config', sa.JSON(), nullable=True))
    op.add_column('onboardings', sa.Column('webhook_url', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('onboardings', 'webhook_url')
    op.drop_column('onboardings', 'branding_config')
