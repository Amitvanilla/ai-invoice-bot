"""
Unit tests for embeddings service
"""

import pytest
import numpy as np
from unittest.mock import Mock, AsyncMock, patch

from app.services.embeddings import EmbeddingService
from app.core.exceptions import InvoiceProcessingError


class TestEmbeddingService:
    """Test cases for EmbeddingService"""

    @pytest.fixture
    def embedding_service(self):
        """Create EmbeddingService instance"""
        return EmbeddingService()

    @pytest.mark.asyncio
    async def test_generate_embeddings_success(self, embedding_service):
        """Test successful embedding generation"""
        test_text = "This is a test invoice"
        mock_embeddings = [0.1, 0.2, 0.3, 0.4, 0.5]

        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            mock_response = Mock()
            mock_response.data = [Mock()]
            mock_response.data[0].embedding = mock_embeddings
            mock_create.return_value = mock_response

            result = await embedding_service.generate_embeddings(test_text)

            assert result == mock_embeddings
            mock_create.assert_called_once_with(
                input=test_text,
                model=embedding_service.model,
                dimensions=embedding_service.dimensions
            )

    @pytest.mark.asyncio
    async def test_generate_embeddings_failure(self, embedding_service):
        """Test embedding generation failure"""
        with patch.object(embedding_service.client.embeddings, 'create', side_effect=Exception("API Error")):

            with pytest.raises(InvoiceProcessingError) as exc_info:
                await embedding_service.generate_embeddings("test text")

            assert "Embedding generation failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_generate_multiple_embeddings(self, embedding_service):
        """Test multiple embedding generation"""
        test_texts = ["Text 1", "Text 2", "Text 3"]
        mock_embeddings = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]

        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            mock_response = Mock()
            mock_response.data = [
                Mock(embedding=emb) for emb in mock_embeddings
            ]
            mock_create.return_value = mock_response

            result = await embedding_service.generate_multiple_embeddings(test_texts)

            assert result == mock_embeddings
            mock_create.assert_called_once_with(
                input=test_texts,
                model=embedding_service.model,
                dimensions=embedding_service.dimensions
            )

    def test_cosine_similarity(self, embedding_service):
        """Test cosine similarity calculation"""
        a = [1, 0, 0]
        b = [0, 1, 0]

        similarity = embedding_service.cosine_similarity(a, b)
        assert similarity == 0.0  # Orthogonal vectors

        # Test identical vectors
        similarity = embedding_service.cosine_similarity(a, a)
        assert similarity == 1.0

        # Test parallel vectors
        c = [2, 0, 0]
        similarity = embedding_service.cosine_similarity(a, c)
        assert similarity == 1.0

    def test_cosine_similarity_zero_vector(self, embedding_service):
        """Test cosine similarity with zero vector"""
        a = [1, 0, 0]
        b = [0, 0, 0]

        similarity = embedding_service.cosine_similarity(a, b)
        assert similarity == 0.0

    @pytest.mark.asyncio
    async def test_find_similar(self, embedding_service):
        """Test finding similar embeddings"""
        query_embedding = [1, 0, 0]
        stored_embeddings = [
            {"id": "1", "embedding": [1, 0, 0], "metadata": {"type": "invoice"}},  # Perfect match
            {"id": "2", "embedding": [0, 1, 0], "metadata": {"type": "receipt"}},  # Orthogonal
            {"id": "3", "embedding": [0.9, 0.1, 0], "metadata": {"type": "bill"}},  # High similarity
        ]

        results = await embedding_service.find_similar(
            query_embedding, stored_embeddings, threshold=0.8, limit=2
        )

        # Should return the two most similar items above threshold
        assert len(results) == 2
        assert results[0]["id"] == "1"  # Perfect match first
        assert results[1]["id"] == "3"  # High similarity second
        assert all(result["similarity"] >= 0.8 for result in results)

    @pytest.mark.asyncio
    async def test_find_similar_no_matches(self, embedding_service):
        """Test finding similar embeddings with no matches above threshold"""
        query_embedding = [1, 0, 0]
        stored_embeddings = [
            {"id": "1", "embedding": [0, 1, 0], "metadata": {}},  # Low similarity
        ]

        results = await embedding_service.find_similar(
            query_embedding, stored_embeddings, threshold=0.8
        )

        assert len(results) == 0
