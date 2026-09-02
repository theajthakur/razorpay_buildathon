from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import get_settings

settings = get_settings()

connect_args = {}
engine_kwargs = {}
if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import StaticPool
    connect_args["check_same_thread"] = False
    engine_kwargs["poolclass"] = StaticPool

# Setup SQLAlchemy engine and SessionLocal
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Database session dependency for routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
