from fastapi import Depends
from app.config import Settings, settings
from app.services.preprocess_service import ImagePreprocessor
from app.services.hwr_service import HandwritingRecognitionService
from app.services.segmentation_service import AnswerSegmentationService

def get_settings() -> Settings:
    """Dependency injector for Microservice global settings."""
    return settings

def get_preprocessor() -> ImagePreprocessor:
    """Dependency injector for OpenCV ImagePreprocessor service."""
    return ImagePreprocessor()

def get_hwr_service(config: Settings = Depends(get_settings)) -> HandwritingRecognitionService:
    """Dependency injector for Strategy-selected HandwritingRecognitionService."""
    return HandwritingRecognitionService()


def get_segmentation_service() -> AnswerSegmentationService:
    """Dependency injector for AnswerSegmentationService."""
    return AnswerSegmentationService()
