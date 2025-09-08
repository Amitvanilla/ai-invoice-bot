"""
Unit tests for invoice classifier
"""

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch

from app.services.classifier import InvoiceClassifier
from app.core.exceptions import InvoiceProcessingError


class TestInvoiceClassifier:
    """Test cases for InvoiceClassifier"""

    @pytest.fixture
    def classifier(self):
        """Create InvoiceClassifier instance"""
        return InvoiceClassifier()

    @pytest.mark.asyncio
    async def test_classify_invoice_success(self, classifier):
        """Test successful invoice classification"""
        extracted_data = {
            "invoice_number": "INV001",
            "total": "$100.50"
        }

        mock_response = {
            "corrected_value": "INV001",
            "confidence": 0.95,
            "notes": "Valid format"
        }

        with patch.object(classifier, '_classify_with_claude', new_callable=AsyncMock) as mock_claude:
            mock_claude.return_value = {
                "invoice_number": "INV001",
                "invoice_number_confidence": 0.95,
                "model_used": "claude"
            }

            result = await classifier.classify_invoice(extracted_data)

            assert result["invoice_number"] == "INV001"
            assert result["invoice_number_confidence"] == 0.95
            assert result["model_used"] == "claude"

    @pytest.mark.asyncio
    async def test_classify_invoice_claude_fallback_to_openai(self, classifier):
        """Test Claude failure with OpenAI fallback"""
        extracted_data = {"invoice_number": "INV001"}

        with patch.object(classifier, '_classify_with_claude', side_effect=Exception("Claude failed")), \
             patch.object(classifier, '_classify_with_openai', new_callable=AsyncMock) as mock_openai:

            mock_openai.return_value = {
                "invoice_number": "INV001",
                "invoice_number_confidence": 0.85,
                "model_used": "openai"
            }

            result = await classifier.classify_invoice(extracted_data)

            assert result["model_used"] == "openai"
            assert result["invoice_number_confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_classify_invoice_both_models_fail(self, classifier):
        """Test when both Claude and OpenAI fail"""
        extracted_data = {"invoice_number": "INV001"}

        with patch.object(classifier, '_classify_with_claude', side_effect=Exception("Claude failed")), \
             patch.object(classifier, '_classify_with_openai', side_effect=Exception("OpenAI failed")):

            result = await classifier.classify_invoice(extracted_data)

            assert result["invoice_number"] == "INV001"
            assert result["invoice_number_confidence"] == 0.0
            assert result["invoice_number_model"] == "failed"

    def test_build_classification_prompt(self, classifier):
        """Test classification prompt building"""
        prompt = classifier._build_classification_prompt("invoice_number", "INV001")

        assert "Field: invoice_number" in prompt
        assert "Value: INV001" in prompt
        assert "corrected_value" in prompt
        assert "confidence" in prompt

    def test_parse_classification_response_valid_json(self, classifier):
        """Test parsing valid JSON response"""
        response_text = '{"corrected_value": "INV001", "confidence": 0.95, "notes": "Valid"}'

        result = classifier._parse_classification_response(response_text, "invoice_number", "INV001")

        assert result["invoice_number"] == "INV001"
        assert result["invoice_number_confidence"] == 0.95
        assert result["invoice_number_notes"] == "Valid"

    def test_parse_classification_response_invalid_json(self, classifier):
        """Test parsing invalid JSON response"""
        response_text = "This is not JSON, but the invoice looks valid."

        result = classifier._parse_classification_response(response_text, "invoice_number", "INV001")

        assert result["invoice_number"] == "INV001"
        assert result["invoice_number_confidence"] == 0.5
        assert result["invoice_number_notes"] == "Manual review recommended"
