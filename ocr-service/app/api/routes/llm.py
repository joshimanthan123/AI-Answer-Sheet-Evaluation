from fastapi import APIRouter, Depends, status
from app.models.response_models import ApiResponse
from app.models.llm_models import LLMRequest
from app.providers.base_provider import ILLMProvider
from app.dependencies import get_llm_provider

router = APIRouter(prefix="/api/v1/llm", tags=["LLM"])

@router.post(
    "/generate",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate LLM Text Response",
    description="Dispatches system and user prompts to the active LLM provider.",
)
async def generate_response(
    request: LLMRequest,
    provider: ILLMProvider = Depends(get_llm_provider)
) -> ApiResponse:
    """
    Evaluates prompts using the configured LLM provider and returns normalized responses.
    """
    response_data = await provider.generate(request)
    return ApiResponse(
        success=True,
        message="LLM text generation completed successfully.",
        data=response_data.model_dump()
    )

@router.get(
    "/health",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Get LLM Provider Health Status",
    description="Gets configured environment status and validates connection checks.",
)
async def health_check(
    provider: ILLMProvider = Depends(get_llm_provider)
) -> ApiResponse:
    """
    Returns diagnostic connectivity reports for the active LLM provider.
    """
    health_data = await provider.health_check()
    return ApiResponse(
        success=True,
        message="Provider status checked successfully.",
        data=health_data.model_dump()
    )
