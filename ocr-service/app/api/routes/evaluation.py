import logging
from typing import Any
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.dependencies import get_evaluation_service
from app.services.evaluation_service import EvaluationService
from app.models.evaluation_models import EvaluationRequest, EvaluationResult, EvaluationSummary

logger = logging.getLogger("app.api.routes.evaluation")

router = APIRouter(prefix="/api/v1/evaluations", tags=["Evaluations"])


class StandardResponse(BaseModel):
    success: bool
    data: Any
    message: str | None = None


class SummaryRequestItem(BaseModel):
    marks_awarded: float = Field(..., ge=0)
    maximum_marks: float = Field(..., gt=0)


class EvaluationSummaryRequest(BaseModel):
    results: list[SummaryRequestItem]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=StandardResponse,
    summary="Evaluate student answer segment structurally",
)
async def evaluate_answer(
    request: EvaluationRequest,
    evaluation_service: EvaluationService = Depends(get_evaluation_service)
) -> StandardResponse:
    """
    POST /api/v1/evaluations endpoint to execute automated question evaluation.
    """
    logger.info("REST request - POST /evaluations - Answer Key: %s, Question: %s", request.answer_key_id, request.question_number)
    
    result = await evaluation_service.evaluate(request)
    
    return StandardResponse(
        success=True,
        data=result,
        message="Evaluation completed successfully."
    )


@router.post(
    "/summary",
    status_code=status.HTTP_200_OK,
    response_model=StandardResponse,
    summary="Compute overall metrics for evaluation outcomes",
)
def compute_evaluation_summary(
    request: EvaluationSummaryRequest,
    evaluation_service: EvaluationService = Depends(get_evaluation_service)
) -> StandardResponse:
    """
    POST /api/v1/evaluations/summary endpoint to compile exam evaluation sheets metrics.
    """
    logger.info("REST request - POST /evaluations/summary - Count: %d", len(request.results))
    
    # Map input items to lists of dicts
    results_list = [item.model_dump() for item in request.results]
    summary = evaluation_service.calculate_summary(results_list)
    
    return StandardResponse(
        success=True,
        data=summary,
        message="Evaluation summary calculated successfully."
    )
