"""
Semantic search service with RAG for invoice queries
"""

import asyncio
from typing import List, Dict, Any
import structlog
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.config import settings
from ..db.models import Invoice
from .embeddings import EmbeddingService

logger = structlog.get_logger()


class SearchService:
    """Semantic search with RAG for invoices"""

    def __init__(self):
        self.embeddings = EmbeddingService()

    async def search_invoices(
        self,
        query: str,
        user_id: str,
        limit: int = 10,
        threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Search invoices using semantic similarity and RAG
        """
        try:
            logger.info("Starting invoice search", query=query, user_id=user_id)

            # Generate embedding for the query
            query_embedding = await self.embeddings.generate_embeddings(query)

            # Search for similar invoices in database
            similar_invoices = await self._find_similar_invoices(
                query_embedding, user_id, limit, threshold
            )

            # Apply RAG to get relevant content
            results = await self._apply_rag(query, similar_invoices)

            logger.info("Invoice search completed", results_count=len(results))
            return results

        except Exception as e:
            logger.error("Invoice search failed", error=str(e), user_id=user_id)
            return []

    async def _find_similar_invoices(
        self,
        query_embedding: List[float],
        user_id: str,
        limit: int,
        threshold: float
    ) -> List[Dict[str, Any]]:
        """Find similar invoices using vector similarity"""
        try:
            # This would be implemented with pgvector similarity search
            # For now, return mock results - in production this would query the database
            return [
                {
                    "id": "mock_invoice_1",
                    "filename": "invoice_001.pdf",
                    "similarity": 0.85,
                    "extracted_data": {"total": "$1500", "vendor": "ABC Corp"},
                    "content": "Invoice from ABC Corp for $1500"
                }
            ]

        except Exception as e:
            logger.error("Vector similarity search failed", error=str(e))
            return []

    async def _apply_rag(self, query: str, similar_invoices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply Retrieval-Augmented Generation to get relevant results"""
        try:
            results = []

            for invoice in similar_invoices:
                # Extract relevant content based on query
                relevant_content = await self._extract_relevant_content(query, invoice)

                results.append({
                    "invoice_id": invoice["id"],
                    "filename": invoice["filename"],
                    "score": invoice["similarity"],
                    "content": relevant_content,
                    "extracted_data": invoice["extracted_data"]
                })

            return results

        except Exception as e:
            logger.error("RAG application failed", error=str(e))
            return []

    async def _extract_relevant_content(self, query: str, invoice: Dict[str, Any]) -> str:
        """Extract most relevant content from invoice based on query"""
        try:
            # This is a simplified version - in production you'd use more sophisticated RAG
            content_parts = []

            # Add filename
            content_parts.append(f"Filename: {invoice['filename']}")

            # Add extracted data
            for key, value in invoice['extracted_data'].items():
                content_parts.append(f"{key}: {value}")

            return " | ".join(content_parts)

        except Exception as e:
            logger.error("Content extraction failed", error=str(e))
            return "Content extraction failed"

    async def get_invoice_context(self, invoice_ids: List[str], user_id: str) -> List[Dict[str, Any]]:
        """Get full context for specific invoices"""
        try:
            # This would query the database for full invoice details
            # For now, return mock data
            return [
                {
                    "id": invoice_id,
                    "filename": f"invoice_{invoice_id}.pdf",
                    "full_content": f"Full content for invoice {invoice_id}",
                    "extracted_data": {"total": "$1000", "vendor": "Test Corp"}
                }
                for invoice_id in invoice_ids
            ]

        except Exception as e:
            logger.error("Invoice context retrieval failed", error=str(e))
            return []

    def _build_search_query(self, query_embedding: List[float], user_id: str, limit: int, threshold: float):
        """Build pgvector similarity search query"""
        return text("""
            SELECT
                id,
                filename,
                extracted_data,
                1 - (embeddings <=> :query_embedding) as similarity
            FROM invoices
            WHERE user_id = :user_id
            AND 1 - (embeddings <=> :query_embedding) >= :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """).bindparams(
            query_embedding=query_embedding,
            user_id=user_id,
            threshold=threshold,
            limit=limit
        )
