"""
Invoice API routes
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
import structlog

from ...db.session import get_db
from ...schemas.invoice import (
    InvoiceResponse,
    InvoiceQuery,
    InvoiceSearchResponse,
    InvoiceUploadResponse
)
from ...services.invoice_processor import InvoiceProcessor
from ...core.security import verify_token

logger = structlog.get_logger()
router = APIRouter()
security = security = HTTPBearer()


@router.post("/upload", response_model=InvoiceUploadResponse)
async def upload_invoice(
    file: UploadFile = File(...),
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Upload and process an invoice
    - Parses invoice using Landing AI
    - Classifies fields using Claude/OpenAI
    - Stores structured data with embeddings
    """
    try:
        processor = InvoiceProcessor()
        result = await processor.process_invoice(file, current_user)

        return InvoiceUploadResponse(
            id=result["id"],
            filename=file.filename,
            status="processed",
            message="Invoice processed successfully"
        )

    except Exception as e:
        logger.error("Invoice upload failed", error=str(e), user=current_user)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/", response_model=List[InvoiceResponse])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    List user's processed invoices
    """
    try:
        from ...db.models import Invoice

        invoices = db.query(Invoice).filter(
            Invoice.user_id == current_user
        ).offset(skip).limit(limit).all()

        return [InvoiceResponse.from_orm(invoice) for invoice in invoices]

    except Exception as e:
        logger.error("Invoice listing failed", error=str(e), user=current_user)
        raise HTTPException(status_code=500, detail="Failed to list invoices")


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get specific invoice details
    """
    try:
        from ...db.models import Invoice

        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.user_id == current_user
        ).first()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        return InvoiceResponse.from_orm(invoice)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Invoice retrieval failed", error=str(e), invoice_id=invoice_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve invoice")


@router.post("/search", response_model=List[InvoiceSearchResponse])
async def search_invoices(
    query: InvoiceQuery,
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Semantic search through processed invoices using RAG
    """
    try:
        from ...services.search import SearchService

        search_service = SearchService()
        results = await search_service.search_invoices(
            query.query,
            current_user,
            limit=query.limit,
            threshold=query.threshold
        )

        return [
            InvoiceSearchResponse(
                invoice_id=result["invoice_id"],
                filename=result["filename"],
                relevance_score=result["score"],
                matched_content=result["content"],
                extracted_data=result["extracted_data"]
            )
            for result in results
        ]

    except Exception as e:
        logger.error("Invoice search failed", error=str(e), user=current_user)
        raise HTTPException(status_code=500, detail="Search failed")


@router.post("/{invoice_id}/export")
async def export_invoice(
    invoice_id: str,
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Export invoice data to Excel and upload to S3
    """
    try:
        from ...db.models import Invoice
        from ...services.invoice_processor import InvoiceProcessor

        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.user_id == current_user
        ).first()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        processor = InvoiceProcessor()
        export_url = await processor.export_to_excel(invoice)

        return {
            "export_url": export_url,
            "status": "success",
            "message": "Invoice exported successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Invoice export failed", error=str(e), invoice_id=invoice_id)
        raise HTTPException(status_code=500, detail="Export failed")
