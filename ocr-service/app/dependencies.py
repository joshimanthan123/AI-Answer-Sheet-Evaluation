from fastapi import Depends
from app.config import Settings, settings
from app.services.preprocess_service import ImagePreprocessor
from app.services.hwr_service import HandwritingRecognitionService
from app.services.segmentation_service import AnswerSegmentationService
from app.repositories.answer_key_repository import IAnswerKeyRepository, MemoryAnswerKeyRepository
from app.services.answer_key_service import AnswerKeyService

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


# Singleton repository instance to maintain in-memory state across FastAPI request lifecycle
_answer_key_repo = MemoryAnswerKeyRepository()

def get_answer_key_repository() -> IAnswerKeyRepository:
    """Dependency injector for IAnswerKeyRepository (Memory Repository singleton)."""
    return _answer_key_repo

def get_answer_key_service(
    repo: IAnswerKeyRepository = Depends(get_answer_key_repository)
) -> AnswerKeyService:
    """Dependency injector for AnswerKeyService."""
    return AnswerKeyService(repo)
