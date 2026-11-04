from typing import List, Literal, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

# =========================================================================
# Phase 3B Legacy Models (kept for backward compatibility)
# =========================================================================

class EvaluationCriteria(BaseModel):
    """
    Scoring weights and mark limits for evaluating a single question.
    """
    maximum_marks: float = Field(..., description="Maximum marks possible for this question")
    passing_marks: float = Field(..., description="Passing cutoff marks")
    keyword_weight: float = Field(..., description="Proportionate weight of keyword scoring [0.0 - 1.0]")
    semantic_weight: float = Field(..., description="Proportionate weight of semantic similarity scoring [0.0 - 1.0]")
    completeness_weight: float = Field(..., description="Proportionate weight of completeness/length scoring [0.0 - 1.0]")


class EvaluatedAnswer(BaseModel):
    """
    Result of evaluating an individual student answer.
    """
    question_number: str
    student_answer: str
    reference_answer: str
    maximum_marks: float
    awarded_marks: float
    semantic_similarity: float
    keyword_score: float
    completeness_score: float
    confidence: float
    feedback: str
    reasoning: str
    strengths: List[str]
    improvements: List[str]
    provider_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata from LLM provider (usage, request id, etc.)")


class AnswerEvaluationResult(BaseModel):
    """
    Unified result for the student's entire exam evaluation (Legacy).
    """
    exam_id: str
    student_id: str
    evaluated_answers: List[EvaluatedAnswer]
    total_marks: float
    maximum_marks: float
    percentage: float
    overall_feedback: str
    warnings: List[str]
    execution_time: float
    status: Literal["SUCCESS", "PARTIAL_SUCCESS", "FAILED"]
    average_similarity: float
    average_keyword_score: float
    processing_provider: str
    processing_model: str


# =========================================================================
# Phase 3D Models
# =========================================================================

class EvaluationRequest(BaseModel):
    answer_key_id: str
    question_number: str
    student_answer: str

    @field_validator("answer_key_id")
    @classmethod
    def validate_answer_key_id(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("answer_key_id cannot be empty or whitespace only")
        return v

    @field_validator("question_number")
    @classmethod
    def validate_question_number(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question_number cannot be empty or whitespace only")
        return v

    @field_validator("student_answer")
    @classmethod
    def validate_student_answer(cls, v: str) -> str:
        # Trim whitespace
        return v.strip()


class EvaluationResult(BaseModel):
    answer_key_id: str
    question_number: str
    student_answer: str
    marks_awarded: float
    maximum_marks: float
    feedback: str
    strengths: List[str]
    missing_points: List[str]
    matched_keywords: List[str]
    missing_keywords: List[str]
    confidence: float
    evaluated_by: str
    provider: str
    model: str
    created_at: datetime

    @field_validator("marks_awarded")
    @classmethod
    def validate_marks(cls, v: float, info) -> float:
        if v < 0:
            raise ValueError("marks_awarded cannot be negative")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("confidence must be between 0.0 and 1.0")
        return v


class EvaluationSummary(BaseModel):
    total_marks_awarded: float
    total_maximum_marks: float
    percentage: float
    question_count: int
