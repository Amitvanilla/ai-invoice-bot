"""
Pydantic schemas for invoice processing
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime


class InvoiceBase(BaseModel):
    filename: str
    extracted_data: Dict[str, Any]
    classified_data: Dict[str, Any]


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceResponse(InvoiceBase):
    id: str
    user_id: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class InvoiceQuery(BaseModel):
    query: str = Field(..., description="Search query for semantic search")
    limit: int = Field(10, ge=1, le=50, description="Maximum number of results")
    threshold: float = Field(0.7, ge=0.0, le=1.0, description="Similarity threshold")


class InvoiceSearchResponse(BaseModel):
    invoice_id: str
    filename: str
    relevance_score: float
    matched_content: str
    extracted_data: Dict[str, Any]


class InvoiceUploadResponse(BaseModel):
    id: str
    filename: str
    status: str
    message: str


class InvoiceExportResponse(BaseModel):
    export_url: str
    status: str
    message: str


# Classification schemas
class ClassificationRequest(BaseModel):
    text: str
    fields: List[str] = Field(..., description="Fields to classify")


class ClassificationResponse(BaseModel):
    classifications: Dict[str, str]
    confidence_scores: Dict[str, float]
    model_used: str


# Parsing schemas
class ParsingRequest(BaseModel):
    image_url: str
    fields_to_extract: List[str] = Field(default_factory=lambda: [
        "invoice_number", "date", "vendor_name", "total_amount",
        "tax_amount", "line_items", "payment_terms"
    ])


class ParsingResponse(BaseModel):
    extracted_fields: Dict[str, Any]
    confidence_scores: Dict[str, float]
    processing_time: float
