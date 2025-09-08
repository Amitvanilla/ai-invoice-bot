"""
Invoice processing service with Landing AI parsing and Claude classification
"""

import asyncio
import uuid
import json
import os
from typing import Dict, Any, List
from datetime import datetime
import structlog
import pandas as pd

from ..core.config import settings
from ..core.exceptions import InvoiceProcessingError
from .landing_ai_parser import LandingAIParser
from .classifier import InvoiceClassifier
from .embeddings import EmbeddingService

logger = structlog.get_logger()


class InvoiceProcessor:
    """Main invoice processing service"""

    def __init__(self):
        self.parser = LandingAIParser()
        self.classifier = InvoiceClassifier()
        self.embeddings = EmbeddingService()

    async def process_invoice(self, file, user_id: str) -> Dict[str, Any]:
        """
        Process uploaded invoice file
        """
        try:
            invoice_id = str(uuid.uuid4())
            logger.info("Processing invoice", invoice_id=invoice_id, user_id=user_id)

            # Step 1: Parse invoice using Landing AI
            logger.info("Parsing invoice with Landing AI")
            extracted_data = await self.parser.parse_invoice(file)

            # Step 2: Classify fields using Claude/OpenAI
            logger.info("Classifying invoice fields")
            classified_data = await self.classifier.classify_invoice(extracted_data)

            # Step 3: Generate embeddings for semantic search
            logger.info("Generating embeddings")
            content_to_embed = self._prepare_content_for_embedding(extracted_data, classified_data)
            embeddings = await self.embeddings.generate_embeddings(content_to_embed)

            return {
                "id": invoice_id,
                "extracted_data": extracted_data,
                "classified_data": classified_data,
                "embeddings": embeddings,
                "status": "processed"
            }

        except Exception as e:
            logger.error("Invoice processing failed", error=str(e), user_id=user_id)
            raise InvoiceProcessingError(f"Processing failed: {str(e)}")

    async def export_to_excel(self, invoice) -> str:
        """
        Export invoice data to Excel and save locally
        """
        try:
            # Create exports directory if it doesn't exist
            exports_dir = os.path.join(os.getcwd(), "exports")
            if not os.path.exists(exports_dir):
                os.makedirs(exports_dir)

            # Create user-specific directory
            user_dir = os.path.join(exports_dir, str(invoice.user_id))
            if not os.path.exists(user_dir):
                os.makedirs(user_dir)

            # Prepare data for Excel
            data = {
                "Field": [],
                "Extracted Value": [],
                "Classified Value": [],
                "Confidence": []
            }

            for field in invoice.extracted_data:
                data["Field"].append(field)
                data["Extracted Value"].append(str(invoice.extracted_data[field]))
                data["Classified Value"].append(str(invoice.classified_data.get(field, "")))
                data["Confidence"].append(invoice.classified_data.get(f"{field}_confidence", ""))

            df = pd.DataFrame(data)

            # Create Excel file
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"invoice_{invoice.id}_{timestamp}.xlsx"
            filepath = os.path.join(user_dir, filename)

            with pd.ExcelWriter(filepath, engine='openpyxl') as excel_buffer:
                df.to_excel(excel_buffer, sheet_name='Invoice Data', index=False)

                # Add summary sheet
                summary_data = {
                    "Property": ["Invoice ID", "Filename", "User ID", "Created At", "Status"],
                    "Value": [
                        invoice.id,
                        invoice.filename,
                        invoice.user_id,
                        str(invoice.created_at),
                        invoice.status
                    ]
                }
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(excel_buffer, sheet_name='Summary', index=False)

            logger.info("Excel export completed", filepath=filepath, invoice_id=invoice.id)
            return filepath

        except Exception as e:
            logger.error("Excel export failed", error=str(e), invoice_id=invoice.id)
            raise InvoiceProcessingError(f"Export failed: {str(e)}")

    def _prepare_content_for_embedding(self, extracted_data: Dict, classified_data: Dict) -> str:
        """Prepare content for embedding generation"""
        content_parts = []

        # Add extracted data
        for key, value in extracted_data.items():
            content_parts.append(f"{key}: {value}")

        # Add classified data
        for key, value in classified_data.items():
            if not key.endswith("_confidence"):
                content_parts.append(f"classified_{key}: {value}")

        return " ".join(content_parts)

    def _get_local_file_url(self, filepath: str) -> str:
        """Generate a local file URL for accessing the saved file"""
        try:
            # Convert to URL format for local access
            abs_path = os.path.abspath(filepath)
            # For local development, return the file path
            # In production, this could be served via a static file server
            return abs_path

        except Exception as e:
            logger.error("Local file URL generation failed", error=str(e))
            raise InvoiceProcessingError(f"File URL generation failed: {str(e)}")
