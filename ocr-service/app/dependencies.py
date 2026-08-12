from fastapi import Depends, Header, HTTPException
from app.config import Settings, settings
from app.services.preprocess_service import ImagePreprocessor
from app.services.hwr_service import HandwritingRecognitionService
from app.services.segmentation_service import AnswerSegmentationService
from app.repositories.answer_key_repository import IAnswerKeyRepository, MemoryAnswerKeyRepository
from app.services.answer_key_service import AnswerKeyService
from app.services.prompt_service import PromptService

# Phase 4A Imports
from app.storage.local_storage import LocalStorage
from app.repositories.answer_sheet_repository import IAnswerSheetRepository, MemoryAnswerSheetRepository
from app.services.answer_sheet_service import AnswerSheetService

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


# Singleton PromptService instance
_prompt_service = PromptService()

def get_prompt_service() -> PromptService:
    """Dependency injector for PromptService (singleton)."""
    return _prompt_service


from app.providers.base_provider import ILLMProvider
from app.providers.factory import LLMProviderFactory
from app.services.evaluation_service import EvaluationService
from app.services.evaluation_response_parser import EvaluationResponseParser
from app.services.keyword_service import KeywordService

_llm_providers: dict[str, ILLMProvider] = {}

def get_llm_provider() -> ILLMProvider:
    """
    Dependency injector for ILLMProvider.
    Resolves the configured provider according to settings and caches provider singletons.
    """
    provider_name = settings.LLM_PROVIDER
    if provider_name not in _llm_providers:
        _llm_providers[provider_name] = LLMProviderFactory.create_provider(provider_name)
    return _llm_providers[provider_name]


_evaluation_service: EvaluationService | None = None

def get_evaluation_service(
    answer_key_service: AnswerKeyService = Depends(get_answer_key_service),
    prompt_service: PromptService = Depends(get_prompt_service),
    llm_provider: ILLMProvider = Depends(get_llm_provider)
) -> EvaluationService:
    """Dependency injector for EvaluationService."""
    global _evaluation_service
    if _evaluation_service is None:
        _evaluation_service = EvaluationService(
            answer_key_service=answer_key_service,
            prompt_service=prompt_service,
            llm_provider=llm_provider,
            response_parser=EvaluationResponseParser(),
            keyword_service=KeywordService()
        )
    return _evaluation_service


# Phase 4A singletons & DI hooks
_storage = LocalStorage()
_answer_sheet_repository = MemoryAnswerSheetRepository()

def get_storage() -> LocalStorage:
    return _storage

def get_answer_sheet_repository() -> IAnswerSheetRepository:
    return _answer_sheet_repository

def get_answer_sheet_service(
    storage: LocalStorage = Depends(get_storage),
    repo: IAnswerSheetRepository = Depends(get_answer_sheet_repository),
    preprocessor: ImagePreprocessor = Depends(get_preprocessor),
    hwr_service: HandwritingRecognitionService = Depends(get_hwr_service),
    segmentation_service: AnswerSegmentationService = Depends(get_segmentation_service),
) -> AnswerSheetService:
    return AnswerSheetService(
        storage=storage,
        repository=repo,
        preprocessor=preprocessor,
        hwr_service=hwr_service,
        segmentation_service=segmentation_service,
    )

def get_current_user_id(x_user_id: str = Header(default=None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Header X-User-Id is missing")
    return x_user_id

def get_current_user_role(x_user_role: str = Header(default=None)) -> str:
    if not x_user_role:
        raise HTTPException(status_code=401, detail="Header X-User-Role is missing")
    return x_user_role





