from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/health")
def health_check():
    """
    Health check endpoint to verify that the OCR microservice configuration
    and dependencies are correctly loaded and running.
    """
    return {
        "success": True,
        "service": settings.SERVICE_NAME,
        "status": "Running"
    }
