from pydantic import BaseModel, Field, field_validator

class LLMEvaluationResponse(BaseModel):
    marks: float
    feedback: str
    missing_points: list[str]
    strengths: list[str]
    confidence: float

    @field_validator("marks")
    @classmethod
    def validate_marks(cls, v: float) -> float:
        if v < 0:
            raise ValueError("marks must be greater than or equal to 0")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("confidence must be between 0.0 and 1.0")
        return v
