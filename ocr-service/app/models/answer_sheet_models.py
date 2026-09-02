from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field

class AnswerSheetStatus(str, Enum):
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    PREPROCESSING = "PREPROCESSING"
    OCR_PROCESSING = "OCR_PROCESSING"
    SEGMENTING = "SEGMENTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    # Keep old statuses for backwards compatibility
    PROCESSING = "PROCESSING"
    OCR_COMPLETED = "OCR_COMPLETED"
    SEGMENTED = "SEGMENTED"
    EVALUATION_PENDING = "EVALUATION_PENDING"

class AnswerSheetPage(BaseModel):
    page_number: int
    original_file_reference: str
    processed_file_reference: str
    width: int
    height: int
    processing_status: str
    # Phase 4B fields
    extracted_text: str | None = None
    average_confidence: float | None = None
    confidence_level: str | None = None
    lines: list[dict] = Field(default_factory=list)
    preprocessing_metadata: dict = Field(default_factory=dict)
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    error: dict | None = None

class DigitalAnswer(BaseModel):
    question_number: str
    text: str
    page_number: int
    confidence: float
    # Phase 4B fields
    normalized_question_number: str | None = None
    answer_text: str | None = None
    source_pages: list[int] = Field(default_factory=list)
    confidence_level: str | None = None
    status: str = "READY_FOR_EVALUATION"
    metadata: dict = Field(default_factory=dict)

class AnswerSheetResponse(BaseModel):
    id: UUID | str
    student_id: UUID | str
    exam_id: UUID | str
    original_filename: str
    original_format: str
    file_size: int
    page_count: int
    processing_status: AnswerSheetStatus
    pages: list[AnswerSheetPage] = Field(default_factory=list)
    digital_answers: list[DigitalAnswer] = Field(default_factory=list)
    uploaded_at: datetime
    updated_at: datetime
    # Phase 4B fields
    processing_progress: int = 0
    current_step: str | None = None
    queued_at: datetime | None = None
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    processing_failed_at: datetime | None = None
    error_message: str | None = None
    error_details: str | None = None
    processing_attempt: int = 0
    processing_history: list[dict] = Field(default_factory=list)

