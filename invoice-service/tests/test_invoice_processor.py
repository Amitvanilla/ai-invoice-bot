"""
Unit tests for invoice processor
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from io import BytesIO

from app.services.invoice_processor import InvoiceProcessor
from app.core.exceptions import InvoiceProcessingError


class TestInvoiceProcessor:
    """Test cases for InvoiceProcessor"""

    @pytest.fixture
    def processor(self):
        """Create InvoiceProcessor instance"""
        return InvoiceProcessor()

    @pytest.fixture
    def mock_file(self):
        """Create mock file object"""
        mock_file = Mock()
        mock_file.filename = "test_invoice.pdf"
        mock_file.read = AsyncMock(return_value=b"mock file content")
        return mock_file

    @pytest.mark.asyncio
    async def test_process_invoice_success(self, processor, mock_file):
        """Test successful invoice processing"""
        with patch.object(processor.parser, 'parse_invoice', new_callable=AsyncMock) as mock_parse, \
             patch.object(processor.classifier, 'classify_invoice', new_callable=AsyncMock) as mock_classify, \
             patch.object(processor.embeddings, 'generate_embeddings', new_callable=AsyncMock) as mock_embed:

            # Setup mocks
            mock_parse.return_value = {"invoice_number": "INV001", "total": "$100"}
            mock_classify.return_value = {"invoice_number": "INV001", "total": "$100"}
            mock_embed.return_value = [0.1, 0.2, 0.3]

            # Process invoice
            result = await processor.process_invoice(mock_file, "user123")

            # Assertions
            assert result["extracted_data"]["invoice_number"] == "INV001"
            assert result["classified_data"]["invoice_number"] == "INV001"
            assert result["embeddings"] == [0.1, 0.2, 0.3]
            assert result["status"] == "processed"

            # Verify calls
            mock_parse.assert_called_once()
            mock_classify.assert_called_once()
            mock_embed.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_invoice_parser_failure(self, processor, mock_file):
        """Test invoice processing when parser fails"""
        with patch.object(processor.parser, 'parse_invoice', side_effect=Exception("Parser failed")):

            with pytest.raises(InvoiceProcessingError) as exc_info:
                await processor.process_invoice(mock_file, "user123")

            assert "Parser failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_export_to_excel(self, processor):
        """Test Excel export functionality"""
        mock_invoice = Mock()
        mock_invoice.id = "test-id"
        mock_invoice.filename = "test.pdf"
        mock_invoice.extracted_data = {"total": "$100"}
        mock_invoice.classified_data = {"total": "$100"}
        mock_invoice.created_at = "2024-01-01"

        with patch('app.services.invoice_processor.boto3.client') as mock_boto3, \
             patch('app.services.invoice_processor.pd.ExcelWriter') as mock_writer, \
             patch('builtins.open', create=True) as mock_open:

            # Setup mocks
            mock_s3 = Mock()
            mock_boto3.return_value = mock_s3
            mock_s3.generate_presigned_url.return_value = "https://s3-url.com/file.xlsx"

            # Export invoice
            result = await processor.export_to_excel(mock_invoice)

            # Assertions
            assert result == "https://s3-url.com/file.xlsx"
            mock_s3.upload_fileobj.assert_called_once()
            mock_s3.generate_presigned_url.assert_called_once()

    @pytest.mark.asyncio
    async def test_export_to_excel_s3_failure(self, processor):
        """Test Excel export when S3 upload fails"""
        mock_invoice = Mock()
        mock_invoice.id = "test-id"

        with patch('app.services.invoice_processor.boto3.client') as mock_boto3:
            mock_s3 = Mock()
            mock_boto3.return_value = mock_s3
            mock_s3.upload_fileobj.side_effect = Exception("S3 upload failed")

            with pytest.raises(InvoiceProcessingError) as exc_info:
                await processor.export_to_excel(mock_invoice)

            assert "S3 upload failed" in str(exc_info.value)
