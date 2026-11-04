from uuid import UUID
from fastapi import APIRouter, Depends, status, Response

from app.models.response_models import ApiResponse
from app.models.answer_key_models import (
    CreateAnswerKeyRequest,
    UpdateAnswerKeyRequest,
    AnswerKeyResponse,
)
from app.services.answer_key_service import AnswerKeyService
from app.dependencies import get_answer_key_service

router = APIRouter(prefix="/api/v1/answer-keys", tags=["Answer Keys"])

@router.post(
    "",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Answer Key",
    description="Registers and validates a new typed answer key with designated grading metadata, keywords, and criteria.",
)
async def create_answer_key(
    request: CreateAnswerKeyRequest,
    service: AnswerKeyService = Depends(get_answer_key_service),
) -> ApiResponse:
    result = await service.create_answer_key(request)
    return ApiResponse(
        success=True,
        message="Answer key created successfully.",
        data=result
    )


@router.get(
    "",
    response_model=ApiResponse,
    summary="Retrieve lists of active Answer Keys",
    description="Fetches all active (non-deleted) answer keys.",
)
async def list_answer_keys(
    service: AnswerKeyService = Depends(get_answer_key_service),
) -> ApiResponse:
    results = await service.list_answer_keys()
    return ApiResponse(
        success=True,
        message="Answer keys retrieved successfully.",
        data=results
    )


@router.get(
    "/{id}",
    response_model=ApiResponse,
    summary="Get an Answer Key by ID",
    description="Retrieves a specific active answer key. Returns 404 if deleted or non-existent.",
)
async def get_answer_key(
    id: UUID,
    service: AnswerKeyService = Depends(get_answer_key_service),
) -> ApiResponse:
    result = await service.get_answer_key(id)
    return ApiResponse(
        success=True,
        message="Answer key retrieved successfully.",
        data=result
    )


@router.put(
    "/{id}",
    response_model=ApiResponse,
    summary="Update an existing Answer Key",
    description="Partially updates an active answer key. Validates updated questions, keywords, and marks.",
)
async def update_answer_key(
    id: UUID,
    request: UpdateAnswerKeyRequest,
    service: AnswerKeyService = Depends(get_answer_key_service),
) -> ApiResponse:
    result = await service.update_answer_key(id, request)
    return ApiResponse(
        success=True,
        message="Answer key updated successfully.",
        data=result
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an Answer Key",
    description="Performs soft delete of an answer key. Returns 204 No Content.",
)
async def delete_answer_key(
    id: UUID,
    service: AnswerKeyService = Depends(get_answer_key_service),
) -> Response:
    await service.delete_answer_key(id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
