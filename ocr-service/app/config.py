import os
from pathlib import Path
from pydantic import BaseModel, field_validator

# Locate the root folder of the ocr-service
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    """
    Application settings model using Pydantic for validation and type enforcement.
    Loads configurations from environment variables or defaults.
    """
    SERVICE_NAME: str = "OCR Service"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t", "yes")

    # Directory Paths
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "outputs"
    LOG_DIR: Path = BASE_DIR / "logs"

    # Handwriting Recognition Settings
    HWR_PROVIDER: str = os.getenv("HWR_PROVIDER", "mock")
    AZURE_ENDPOINT: str | None = os.getenv("AZURE_ENDPOINT", None)
    AZURE_API_KEY: str | None = os.getenv("AZURE_API_KEY", None)
    AZURE_TIMEOUT: float = float(os.getenv("AZURE_TIMEOUT", "10.0"))

    # AI Evaluation Settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "mock")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4.1")
    LLM_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "60.0"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))
    ENABLE_KEYWORD_SCORING: bool = os.getenv("ENABLE_KEYWORD_SCORING", "True").lower() in ("true", "1", "t", "yes")
    ENABLE_PARTIAL_MARKING: bool = os.getenv("ENABLE_PARTIAL_MARKING", "True").lower() in ("true", "1", "t", "yes")
    ENABLE_FEEDBACK_GENERATION: bool = os.getenv("ENABLE_FEEDBACK_GENERATION", "True").lower() in ("true", "1", "t", "yes")
    ENABLE_REASONING: bool = os.getenv("ENABLE_REASONING", "True").lower() in ("true", "1", "t", "yes")
    MAX_PROMPT_TOKENS: int = int(os.getenv("MAX_PROMPT_TOKENS", "6000"))
    PROMPT_VERSION: str = os.getenv("PROMPT_VERSION", "v1")

    # OpenAI / Azure OpenAI Credentials
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", None)
    AZURE_OPENAI_ENDPOINT: str | None = os.getenv("AZURE_OPENAI_ENDPOINT", None)
    AZURE_OPENAI_API_KEY: str | None = os.getenv("AZURE_OPENAI_API_KEY", None)
    AZURE_OPENAI_DEPLOYMENT: str | None = os.getenv("AZURE_OPENAI_DEPLOYMENT", None)
    AZURE_OPENAI_API_VERSION: str | None = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")

    # Answer Segmentation Settings
    SEGMENTATION_MIN_CONFIDENCE: float = float(os.getenv("SEGMENTATION_MIN_CONFIDENCE", "0.50"))
    SEGMENTATION_ALLOW_ROMAN: bool = os.getenv("SEGMENTATION_ALLOW_ROMAN", "True").lower() in ("true", "1", "t", "yes")
    SEGMENTATION_ALLOW_SUBQUESTIONS: bool = os.getenv("SEGMENTATION_ALLOW_SUBQUESTIONS", "True").lower() in ("true", "1", "t", "yes")
    SEGMENTATION_MAX_UNKNOWN_LINES: int = int(os.getenv("SEGMENTATION_MAX_UNKNOWN_LINES", "5"))
    SEGMENTATION_VALIDATE_ORDER: bool = os.getenv("SEGMENTATION_VALIDATE_ORDER", "True").lower() in ("true", "1", "t", "yes")
    SEGMENTATION_LONG_ANSWER_THRESHOLD: int = int(os.getenv("SEGMENTATION_LONG_ANSWER_THRESHOLD", "100"))

    # OCR API Settings
    OCR_MAX_UPLOAD_SIZE_MB: int = int(os.getenv("OCR_MAX_UPLOAD_SIZE_MB", "20"))
    OCR_ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    OCR_REQUEST_TIMEOUT: float = float(os.getenv("OCR_REQUEST_TIMEOUT", "60.0"))
    ENABLE_PIPELINE_METRICS: bool = os.getenv("ENABLE_PIPELINE_METRICS", "True").lower() in ("true", "1", "t", "yes")

    @field_validator("HWR_PROVIDER")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        prov = v.lower().strip()
        if prov not in ("mock", "azure"):
            raise ValueError(f"Unsupported OCR provider: {v}. Must be 'mock' or 'azure'")
        return prov

    @field_validator("LLM_PROVIDER")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        prov = v.lower().strip()
        if prov not in ("mock", "openai", "azure"):
            raise ValueError(f"Unsupported LLM provider: {v}. Must be 'mock', 'openai', or 'azure'")
        return prov

    class Config:
        arbitrary_types_allowed = True

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
settings.LOG_DIR.mkdir(parents=True, exist_ok=True)
