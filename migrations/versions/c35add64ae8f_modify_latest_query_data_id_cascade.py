"""modify latest query data id cascade

Revision ID: c35add64ae8f
Revises: e5c7a4e2df4d
Create Date: 2019-06-10 11:00:05.390330

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c35add64ae8f'
down_revision = 'e5c7a4e2df4d'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('queries_latest_query_data_id_fkey', 'queries', type_='foreignkey')
    op.create_foreign_key('queries_latest_query_data_id_fkey', 'queries', 'query_results', ['latest_query_data_id'], ['id'], ondelete='SET NULL')


def downgrade():
    op.drop_constraint('queries_latest_query_data_id_fkey', 'queries', type_='foreignkey')
    op.create_foreign_key('queries_latest_query_data_id_fkey', 'queries', 'query_results', ['latest_query_data_id'], ['id'])