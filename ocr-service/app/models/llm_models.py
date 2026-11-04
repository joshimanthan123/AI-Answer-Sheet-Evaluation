from pydantic import BaseModel, Field, field_validator

class LLMRequest(BaseModel):
    system_prompt: str
    prompt: str
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    max_output_tokens: int = Field(default=2048, gt=0)

    @field_validator("system_prompt", "prompt")
    @classmethod
    def validate_non_empty_string(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only.")
        return v

class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str
    finish_reason: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: float | None = None

class ProviderHealthResponse(BaseModel):
    provider: str
    available: bool
    model: str
    message: str | None = None
