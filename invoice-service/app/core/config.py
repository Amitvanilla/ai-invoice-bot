"""
Application configuration settings
"""

import os
import secrets
from typing import List
from pydantic_settings import BaseSettings
from pydantic import validator, Field


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Application
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)
    PORT: int = 8001

    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    )

    # Database
    DATABASE_URL: str = Field(default="postgresql://postgres:password@localhost:5432/invoices")
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "invoices"

    # Landing AI
    LANDING_AI_API_KEY: str = ""
    LANDING_AI_MODEL_ID: str = ""
    VISION_AGENT_API_KEY: str = ""

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-3-sonnet-20240229"

    # Azure OpenAI Configuration
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_DEPLOYMENT_NAME: str = ""
    AZURE_OPENAI_API_KEY: str = ""

    # OpenAI (fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4-turbo-preview"

    # Local Storage (replaces AWS S3)
    LOCAL_EXPORTS_DIR: str = "./exports"

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Embedding
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # Search
    SIMILARITY_THRESHOLD: float = 0.7
    MAX_SEARCH_RESULTS: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
