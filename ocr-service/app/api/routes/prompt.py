from fastapi import APIRouter, Depends, status

from app.models.response_models import ApiResponse
from app.models.prompt_models import (
    EvaluationPromptRequest,
    KeywordPromptRequest,
    FeedbackPromptRequest,
    PromptResponse,
)
from app.services.prompt_service import PromptService
from app.dependencies import get_prompt_service

router = APIRouter(prefix="/api/v1/prompts", tags=["Prompts"])


@router.post(
    "/evaluation",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Evaluation Prompt",
    description="Loads the evaluation template, runs placeholder validations, and compiles student details into structured prompts.",
)
async def generate_evaluation_prompt(
    request: EvaluationPromptRequest,
    service: PromptService = Depends(get_prompt_service),
) -> ApiResponse:
    result = service.build_evaluation_prompt(request)
    return ApiResponse(
        success=True,
        message="Evaluation prompt compiled successfully.",
        data=result,
    )


@router.post(
    "/keywords",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Keyword Extraction Prompt",
    description="Compiles expected answer text details into keyword extraction prompts.",
)
async def generate_keyword_prompt(
    request: KeywordPromptRequest,
    service: PromptService = Depends(get_prompt_service),
) -> ApiResponse:
    result = service.build_keyword_prompt(request)
    return ApiResponse(
        success=True,
        message="Keyword extraction prompt compiled successfully.",
        data=result,
    )


@router.post(
    "/feedback",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Feedback Prompt",
    description="Compiles awarded marks, strengths, and missing items into constructive student feedback prompts.",
)
async def generate_feedback_prompt(
    request: FeedbackPromptRequest,
    service: PromptService = Depends(get_prompt_service),
) -> ApiResponse:
    result = service.build_feedback_prompt(request)
    return ApiResponse(
        success=True,
        message="Feedback prompt compiled successfully.",
        data=result,
    )


@router.post(
    "/reload",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Reload Prompt Templates",
    description="Flushes in-memory template caches and hot-reloads revised prompt text files from the configuration directory.",
)
async def reload_prompt_templates(
    service: PromptService = Depends(get_prompt_service),
) -> ApiResponse:
    service.reload_templates()
    return ApiResponse(
        success=True,
        message="Prompt templates reloaded successfully.",
        data=None,
    )
