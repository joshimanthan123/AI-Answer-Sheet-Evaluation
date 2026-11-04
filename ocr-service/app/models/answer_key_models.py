from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

class KeywordModel(BaseModel):
    """
    Validation model representing a specific scoring keyword for a question.
    """
    keyword: str
    weight: float = Field(default=1.0, gt=0)

    @field_validator("keyword")
    @classmethod
    def validate_keyword(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("keyword cannot be empty or contain only whitespace")
        return stripped


class AnswerKeyQuestion(BaseModel):
    """
    Validation model representing an expected question inside an answer key.
    """
    question_number: str
    question_text: str
    model_answer: str
    keywords: list[KeywordModel] = Field(default_factory=list)
    maximum_marks: float
    difficulty: Literal["easy", "medium", "hard"] | None = None
    notes: str | None = None
    source: Literal["manual", "ocr"] = "manual"
    expected_time: int | None = None
    minimum_keywords_required: int | None = None
    rubric: str | None = None

    @field_validator("question_number")
    @classmethod
    def normalize_question_number(cls, v: str) -> str:
        n = v.strip().upper()
        if not n:
            raise ValueError("question_number cannot be empty")
        return n

    @field_validator("question_text")
    @classmethod
    def validate_question_text(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("question_text cannot be empty or whitespace only")
        return stripped

    @field_validator("model_answer")
    @classmethod
    def validate_model_answer(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("model_answer cannot be empty or whitespace only")
        # Inline import config to prevent circular dependencies in configurations
        from app.config import settings
        if len(v) > settings.MAX_MODEL_ANSWER_LENGTH:
            raise ValueError(f"model_answer length exceeds maximum of {settings.MAX_MODEL_ANSWER_LENGTH} characters")
        return v

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, v: list[KeywordModel]) -> list[KeywordModel]:
        from app.config import settings
        if len(v) > settings.MAX_KEYWORDS:
            raise ValueError(f"keywords count exceeds maximum of {settings.MAX_KEYWORDS}")
        return v

    @field_validator("maximum_marks")
    @classmethod
    def validate_maximum_marks(cls, v: float) -> float:
        from app.config import settings
        if v <= 0:
            raise ValueError("maximum_marks must be greater than 0")
        if v > settings.MAX_QUESTION_MARKS:
            raise ValueError(f"maximum_marks exceeds maximum allowed of {settings.MAX_QUESTION_MARKS}")
        return v

    @field_validator("expected_time")
    @classmethod
    def validate_expected_time(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("expected_time must be greater than 0")
        return v

    @field_validator("minimum_keywords_required")
    @classmethod
    def validate_min_keywords(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("minimum_keywords_required cannot be negative")
        return v


class CreateAnswerKeyRequest(BaseModel):
    """
    Model schema for creating a new answer key.
    """
    subject: str
    subject_code: str | None = None
    exam_name: str
    exam_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    faculty_name: str
    status: Literal["draft", "published"] = "draft"
    version: int = 1
    questions: list[AnswerKeyQuestion]

    @field_validator("subject", "exam_name", "faculty_name")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("String field cannot be empty or whitespace only")
        return stripped

    @field_validator("questions")
    @classmethod
    def validate_questions_list(cls, v: list[AnswerKeyQuestion]) -> list[AnswerKeyQuestion]:
        if not v:
            raise ValueError("questions list must contain at least one question")
        return v


class AnswerKeyResponse(BaseModel):
    """
    Full envelope representation of a saved answer key.
    """
    id: UUID
    subject: str
    subject_code: str | None = None
    exam_name: str
    exam_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    faculty_name: str
    status: Literal["draft", "published"]
    version: int
    questions: list[AnswerKeyQuestion]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class UpdateAnswerKeyRequest(BaseModel):
    """
    Model schema for updating an existing answer key. All fields are optional.
    """
    subject: str | None = None
    subject_code: str | None = None
    exam_name: str | None = None
    exam_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    faculty_name: str | None = None
    status: Literal["draft", "published"] | None = None
    version: int | None = None
    questions: list[AnswerKeyQuestion] | None = None

    @field_validator("subject", "exam_name", "faculty_name")
    @classmethod
    def validate_optional_strings(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("String field cannot be empty or whitespace only")
            return stripped
        return v

    @field_validator("questions")
    @classmethod
    def validate_questions_list(cls, v: list[AnswerKeyQuestion] | None) -> list[AnswerKeyQuestion] | None:
        if v is not None and not v:
            raise ValueError("questions list cannot be empty if provided")
        return v
