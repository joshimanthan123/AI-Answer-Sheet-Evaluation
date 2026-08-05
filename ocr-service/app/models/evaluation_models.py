from typing import List, Literal, Dict, Any
from pydantic import BaseModel, Field

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


class EvaluationResult(BaseModel):
    """
    Unified result for the student's entire exam evaluation.
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
