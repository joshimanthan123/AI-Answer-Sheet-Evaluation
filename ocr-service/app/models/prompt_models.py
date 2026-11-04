from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator


class PromptType(str, Enum):
    """Enumeration of supported template prompt types."""
    SYSTEM = "system"
    EVALUATION = "evaluation"
    KEYWORD = "keyword"
    FEEDBACK = "feedback"


class EvaluationPromptRequest(BaseModel):
    """Schema for evaluating a student response prompt generation."""
    question: str
    student_answer: str
    model_answer: str
    maximum_marks: float
    keywords: list[str] = Field(default_factory=list)
    rubric: str | None = None

    @field_validator("question", "model_answer")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:

        if not v.strip():
            raise ValueError("Field cannot be empty or contain only whitespace")
        return v

    @field_validator("maximum_marks")
    @classmethod
    def validate_marks(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("maximum_marks must be greater than 0")
        return v


class KeywordPromptRequest(BaseModel):
    """Schema for keyword extraction prompt generation."""
    model_answer: str

    @field_validator("model_answer")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("model_answer cannot be empty or contain only whitespace")
        return v


class FeedbackPromptRequest(BaseModel):
    """Schema for student constructive feedback prompt generation."""
    marks: float
    strengths: list[str] = Field(default_factory=list)
    missing_points: list[str] = Field(default_factory=list)

    @field_validator("marks")
    @classmethod
    def validate_positive_marks(cls, v: float) -> float:
        if v < 0:
            raise ValueError("marks cannot be negative")
        return v


class PromptResponse(BaseModel):
    """API payload response returning compiled template outputs."""
    system_prompt: str
    prompt: str
    metadata: dict[str, Any]
    llm_parameters: dict[str, Any] = Field(default_factory=dict)
