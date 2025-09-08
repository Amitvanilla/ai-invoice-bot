"""
Database session configuration
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator

from ..core.config import settings

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=settings.DEBUG,
    connect_args={
        "options": "-c timezone=utc"
    } if "postgresql" in settings.DATABASE_URL else {}
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_database():
    """Create all database tables"""
    from .models import Base, create_vector_extension, create_similarity_function

    # Create vector extension
    with engine.connect() as conn:
        conn.execute(create_vector_extension())
        conn.execute(create_similarity_function())
        conn.commit()

    # Create all tables
    Base.metadata.create_all(bind=engine)


def reset_database():
    """Drop and recreate all tables (for development/testing)"""
    from .models import Base

    Base.metadata.drop_all(bind=engine)
    create_database()
