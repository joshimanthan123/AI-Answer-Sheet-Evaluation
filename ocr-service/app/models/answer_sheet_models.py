from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field

class AnswerSheetStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    OCR_COMPLETED = "OCR_COMPLETED"
    SEGMENTED = "SEGMENTED"
    EVALUATION_PENDING = "EVALUATION_PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class AnswerSheetPage(BaseModel):
    page_number: int
    original_file_reference: str
    processed_file_reference: str
    width: int
    height: int
    processing_status: str

class DigitalAnswer(BaseModel):
    question_number: str
    text: str
    page_number: int
    confidence: float

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
