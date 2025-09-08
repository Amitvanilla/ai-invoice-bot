"""
Custom exceptions for the invoice processing service
"""


class InvoiceProcessingError(Exception):
    """Base exception for invoice processing errors"""
    pass


class LandingAIError(InvoiceProcessingError):
    """Error from Landing AI API"""
    pass


class ClassificationError(InvoiceProcessingError):
    """Error during field classification"""
    pass


class EmbeddingError(InvoiceProcessingError):
    """Error during embedding generation"""
    pass


class DatabaseError(InvoiceProcessingError):
    """Database operation error"""
    pass


class S3UploadError(InvoiceProcessingError):
    """S3 upload error"""
    pass


class AuthenticationError(Exception):
    """Authentication related errors"""
    pass


class AuthorizationError(Exception):
    """Authorization related errors"""
    pass
