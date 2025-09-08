"""
Landing AI invoice parsing service
"""

import httpx
import json
from typing import Dict, Any, List
import structlog
from PIL import Image
import io

from ..core.config import settings
from ..core.exceptions import InvoiceProcessingError

logger = structlog.get_logger()


class LandingAIParser:
    """Invoice parsing using Landing AI"""

    def __init__(self):
        self.api_key = settings.LANDING_AI_API_KEY
        self.model_id = settings.LANDING_AI_MODEL_ID
        self.base_url = "https://api.landing.ai"

    async def parse_invoice(self, file) -> Dict[str, Any]:
        """
        Parse invoice using Landing AI
        """
        try:
            # Read file content
            content = await file.read()
            filename = file.filename

            logger.info("Starting Landing AI parsing", filename=filename)

            # Convert to PIL Image if needed
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
                image = Image.open(io.BytesIO(content))
                # Preprocess image if needed
                image = self._preprocess_image(image)
                content = self._image_to_bytes(image)

            # Call Landing AI API
            result = await self._call_landing_ai_api(content, filename)

            # Extract structured data
            extracted_data = self._extract_structured_data(result)

            logger.info("Landing AI parsing completed", fields_found=len(extracted_data))

            return extracted_data

        except Exception as e:
            logger.error("Landing AI parsing failed", error=str(e))
            raise InvoiceProcessingError(f"Landing AI parsing failed: {str(e)}")

    async def _call_landing_ai_api(self, content: bytes, filename: str) -> Dict[str, Any]:
        """Call Landing AI API for invoice parsing"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/octet-stream"
            }

            params = {
                "model_id": self.model_id,
                "filename": filename
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/invoice/parsing",
                    headers=headers,
                    params=params,
                    content=content
                )

                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            logger.error("Landing AI API error", status_code=e.response.status_code if e.response else "unknown")
            raise InvoiceProcessingError(f"Landing AI API error: {str(e)}")

    def _extract_structured_data(self, api_response: Dict[str, Any]) -> Dict[str, Any]:
        """Extract structured data from Landing AI response"""
        try:
            extracted_data = {}

            # Extract common invoice fields
            if "predictions" in api_response:
                predictions = api_response["predictions"]

                # Map common fields
                field_mapping = {
                    "invoice_number": ["invoice_number", "invoice_no", "inv_number"],
                    "date": ["date", "invoice_date", "issue_date"],
                    "vendor_name": ["vendor", "supplier", "company", "vendor_name"],
                    "total_amount": ["total", "amount", "total_amount", "grand_total"],
                    "tax_amount": ["tax", "tax_amount", "vat", "gst"],
                    "payment_terms": ["payment_terms", "terms", "due_date"]
                }

                for prediction in predictions:
                    label = prediction.get("label", "").lower()
                    value = prediction.get("text", "")
                    confidence = prediction.get("confidence", 0.0)

                    # Map to standardized fields
                    for standard_field, possible_labels in field_mapping.items():
                        if any(possible_label in label for possible_label in possible_labels):
                            if standard_field not in extracted_data or confidence > extracted_data[f"{standard_field}_confidence"]:
                                extracted_data[standard_field] = value
                                extracted_data[f"{standard_field}_confidence"] = confidence
                            break

                    # Keep all predictions for reference
                    extracted_data.setdefault("all_predictions", []).append(prediction)

            return extracted_data

        except Exception as e:
            logger.error("Data extraction failed", error=str(e))
            return {"error": f"Data extraction failed: {str(e)}"}

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image for better OCR results"""
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize if too large (Landing AI has size limits)
        max_size = (2000, 2000)
        if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
            image.thumbnail(max_size, Image.Resampling.LANCZOS)

        # Enhance contrast
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)

        return image

    def _image_to_bytes(self, image: Image.Image) -> bytes:
        """Convert PIL Image to bytes"""
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=95)
        return buffer.getvalue()
