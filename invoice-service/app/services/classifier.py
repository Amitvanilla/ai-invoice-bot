"""
Invoice classification service with Claude primary and OpenAI fallback
"""

import asyncio
import json
from typing import Dict, Any, List
import structlog
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from ..core.config import settings
from ..core.exceptions import InvoiceProcessingError

logger = structlog.get_logger()


class InvoiceClassifier:
    """Classify invoice fields using Claude with OpenAI fallback"""

    def __init__(self):
        self.anthropic = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.claude_model = settings.CLAUDE_MODEL
        self.openai_model = settings.OPENAI_MODEL

    async def classify_invoice(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify invoice fields using AI models
        """
        try:
            logger.info("Starting invoice classification")

            # Prepare classification tasks
            tasks = []
            for field, value in extracted_data.items():
                if not field.endswith("_confidence") and field != "all_predictions":
                    tasks.append(self._classify_field(field, str(value)))

            # Execute classifications
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            classified_data = {}
            for i, result in enumerate(results):
                field = list(extracted_data.keys())[i]
                if isinstance(result, Exception):
                    logger.warning("Classification failed for field", field=field, error=str(result))
                    classified_data[field] = extracted_data[field]
                    classified_data[f"{field}_confidence"] = 0.0
                    classified_data[f"{field}_model"] = "failed"
                else:
                    classified_data.update(result)

            logger.info("Invoice classification completed", fields_classified=len(classified_data))
            return classified_data

        except Exception as e:
            logger.error("Invoice classification failed", error=str(e))
            raise InvoiceProcessingError(f"Classification failed: {str(e)}")

    async def _classify_field(self, field: str, value: str) -> Dict[str, Any]:
        """Classify a single field with Claude primary, OpenAI fallback"""
        try:
            # Try Claude first
            result = await self._classify_with_claude(field, value)
            result["model_used"] = "claude"
            return result

        except Exception as e:
            logger.warning("Claude classification failed, trying OpenAI", field=field, error=str(e))

            try:
                # Fallback to OpenAI
                result = await self._classify_with_openai(field, value)
                result["model_used"] = "openai"
                return result

            except Exception as e2:
                logger.error("Both classification attempts failed", field=field, error=str(e2))
                return {
                    field: value,
                    f"{field}_confidence": 0.0,
                    f"{field}_model": "failed"
                }

    async def _classify_with_claude(self, field: str, value: str) -> Dict[str, Any]:
        """Classify field using Claude"""
        prompt = self._build_classification_prompt(field, value)

        response = await self.anthropic.messages.create(
            model=self.claude_model,
            max_tokens=1000,
            temperature=0.1,
            system="You are an expert invoice classifier. Analyze the given field and provide the most accurate classification.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return self._parse_classification_response(response.content[0].text, field, value)

    async def _classify_with_openai(self, field: str, value: str) -> Dict[str, Any]:
        """Classify field using OpenAI"""
        prompt = self._build_classification_prompt(field, value)

        response = await self.openai.chat.completions.create(
            model=self.openai_model,
            messages=[
                {"role": "system", "content": "You are an expert invoice classifier. Analyze the given field and provide the most accurate classification."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.1
        )

        return self._parse_classification_response(response.choices[0].message.content, field, value)

    def _build_classification_prompt(self, field: str, value: str) -> str:
        """Build classification prompt for AI models"""
        return f"""
        Analyze this invoice field and provide the most accurate classification:

        Field: {field}
        Value: {value}

        Please provide:
        1. The corrected/normalized value
        2. A confidence score (0.0 to 1.0)
        3. Any validation notes

        Format your response as JSON:
        {{
            "corrected_value": "normalized value",
            "confidence": 0.95,
            "notes": "any validation notes"
        }}
        """

    def _parse_classification_response(self, response_text: str, field: str, original_value: str) -> Dict[str, Any]:
        """Parse AI response and return structured data"""
        try:
            # Try to parse JSON response
            result = json.loads(response_text)

            return {
                field: result.get("corrected_value", original_value),
                f"{field}_confidence": result.get("confidence", 0.5),
                f"{field}_notes": result.get("notes", "")
            }

        except json.JSONDecodeError:
            # Fallback: extract information from text response
            logger.warning("Failed to parse JSON response, using fallback", response=response_text[:200])

            return {
                field: original_value,
                f"{field}_confidence": 0.5,
                f"{field}_notes": "Manual review recommended"
            }

    async def validate_invoice_data(self, classified_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate classified invoice data for consistency"""
        try:
            validation_prompt = f"""
            Validate this invoice data for consistency and accuracy:

            {json.dumps(classified_data, indent=2)}

            Check for:
            - Date format consistency
            - Amount calculations
            - Vendor information completeness
            - Invoice number format

            Provide validation results as JSON with issues and recommendations.
            """

            response = await self.anthropic.messages.create(
                model=self.claude_model,
                max_tokens=1000,
                temperature=0.1,
                messages=[
                    {"role": "user", "content": validation_prompt}
                ]
            )

            validation_result = json.loads(response.content[0].text)
            classified_data["validation"] = validation_result

            return classified_data

        except Exception as e:
            logger.warning("Invoice validation failed", error=str(e))
            classified_data["validation"] = {"status": "failed", "error": str(e)}
            return classified_data
