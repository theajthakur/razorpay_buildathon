import sys
import subprocess
from sqlalchemy import create_engine, inspect
from app.core.config import get_settings

def run():
    settings = get_settings()
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # If users table exists but alembic_version table doesn't exist or has no entries
        if "users" in tables:
            has_alembic_version = "alembic_version" in tables
            should_stamp = False

            if not has_alembic_version:
                should_stamp = True
            else:
                with engine.connect() as conn:
                    from sqlalchemy import text
                    res = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
                    if not res:
                        should_stamp = True

            if should_stamp:
                print("Existing database tables detected without alembic version. Stamping schema to head...")
                subprocess.run(["alembic", "stamp", "head"], check=True)
    except Exception as e:
        print(f"Migration pre-check warning: {e}")
    finally:
        engine.dispose()

    print("Running alembic upgrade head...")
    subprocess.run(["alembic", "upgrade", "head"], check=True)

if __name__ == "__main__":
    run()
