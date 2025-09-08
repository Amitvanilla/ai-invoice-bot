"""
Database models for invoice processing service
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, Index
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class Invoice(Base):
    """Invoice model with vector embeddings"""
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    extracted_data = Column(JSON, nullable=False)
    classified_data = Column(JSON, nullable=False)
    embeddings = Column(Vector(1536), nullable=False)  # OpenAI text-embedding-3-small dimensions
    status = Column(String, default="processing")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes for performance
    __table_args__ = (
        Index('ix_invoices_user_id_created_at', 'user_id', 'created_at'),
        Index('ix_invoices_user_id_status', 'user_id', 'status'),
    )


class User(Base):
    """User model for authentication"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(String, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Vector similarity search function
def create_vector_extension():
    """SQL to create pgvector extension"""
    return """
    CREATE EXTENSION IF NOT EXISTS vector;
    """

def create_similarity_function():
    """SQL to create cosine similarity function"""
    return """
    CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
    RETURNS float
    LANGUAGE sql
    IMMUTABLE STRICT
    AS $$
        SELECT 1 - (a <=> b)
    $$;
    """
