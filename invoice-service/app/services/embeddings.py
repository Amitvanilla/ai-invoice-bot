"""
Embedding service for vector search using OpenAI
"""

import asyncio
from typing import List, Dict, Any
import structlog
from openai import AsyncOpenAI
import numpy as np

from ..core.config import settings
from ..core.exceptions import InvoiceProcessingError

logger = structlog.get_logger()


class EmbeddingService:
    """Generate embeddings for semantic search"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS

    async def generate_embeddings(self, text: str) -> List[float]:
        """
        Generate embeddings for the given text
        """
        try:
            logger.info("Generating embeddings", text_length=len(text), model=self.model)

            response = await self.client.embeddings.create(
                input=text,
                model=self.model,
                dimensions=self.dimensions
            )

            embeddings = response.data[0].embedding

            logger.info("Embeddings generated", dimensions=len(embeddings))
            return embeddings

        except Exception as e:
            logger.error("Embedding generation failed", error=str(e))
            raise InvoiceProcessingError(f"Embedding generation failed: {str(e)}")

    async def generate_multiple_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        """
        try:
            logger.info("Generating multiple embeddings", count=len(texts), model=self.model)

            response = await self.client.embeddings.create(
                input=texts,
                model=self.model,
                dimensions=self.dimensions
            )

            embeddings = [data.embedding for data in response.data]

            logger.info("Multiple embeddings generated", count=len(embeddings))
            return embeddings

        except Exception as e:
            logger.error("Multiple embedding generation failed", error=str(e))
            raise InvoiceProcessingError(f"Multiple embedding generation failed: {str(e)}")

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            a_np = np.array(a)
            b_np = np.array(b)

            dot_product = np.dot(a_np, b_np)
            norm_a = np.linalg.norm(a_np)
            norm_b = np.linalg.norm(b_np)

            return dot_product / (norm_a * norm_b)
        except Exception as e:
            logger.error("Cosine similarity calculation failed", error=str(e))
            return 0.0

    async def find_similar(
        self,
        query_embedding: List[float],
        stored_embeddings: List[Dict[str, Any]],
        threshold: float = 0.7,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Find similar embeddings using cosine similarity
        """
        try:
            similarities = []

            for item in stored_embeddings:
                similarity = self.cosine_similarity(query_embedding, item["embedding"])
                if similarity >= threshold:
                    similarities.append({
                        "id": item["id"],
                        "similarity": similarity,
                        "metadata": item.get("metadata", {})
                    })

            # Sort by similarity (highest first)
            similarities.sort(key=lambda x: x["similarity"], reverse=True)

            return similarities[:limit]

        except Exception as e:
            logger.error("Similarity search failed", error=str(e))
            return []
