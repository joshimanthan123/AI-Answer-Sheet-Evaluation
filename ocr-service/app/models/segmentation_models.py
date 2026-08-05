from pydantic import BaseModel, Field
from typing import List, Dict, Any

class AnswerMetadata(BaseModel):
    """
    Structured metadata representing page indexing and line telemetry.
    Can be easily extended with bounding boxes, spatial coordinates,
    or provider details without breaking signature contracts.
    """
    page_start: int = Field(description="The starting page number (1-indexed) containing the answer.")
    page_end: int = Field(description="The ending page number (1-indexed) containing the answer.")
    line_count: int = Field(description="The total number of physical OCR lines comprising the text body.")
    extra_info: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Optional extensions like bounding boxes or spatial segments."
    )


class SegmentedAnswer(BaseModel):
    """
    Standardized, provider-independent model representing a single question's answer block.
    """
    question_number: str = Field(description="The parsed, sanitized question tag identifier.")
    normalized_question_number: str = Field(description="Canonical format for query operations: e.g. Q1, Q2(a), SecA, RomanII.")
    original_header: str = Field(description="The exact text line matched by the question parser.")
    answer_text: str = Field(description="The reconstructed, cleaned answer string preserving line order.")
    confidence: float = Field(description="Arithmetic mean of line confidences (0.0 to 1.0).")
    start_line: int = Field(description="1-based offset index in the combined line list specifying answer start.")
    end_line: int = Field(description="1-based offset index specifying answer end.")
    metadata: AnswerMetadata = Field(description="Detailed metadata detailing page and line counts.")


class SegmentationResult(BaseModel):
    """
    The output encapsulating all mapped answers and warning diagnostics of the segmentation pipeline.
    """
    answers: List[SegmentedAnswer] = Field(description="List of segmented answer models ordered sequentially.")
    duplicate_questions: List[str] = Field(description="List of duplicate question numbers detected during parse.")
    missing_questions: List[str] = Field(description="List of question numbers that appear to be skipped in sequence.")
    unknown_sections: List[str] = Field(description="Unclassified line text blocks parsed before the first valid question header.")
    warnings: List[str] = Field(description="Diagnostic warning log codes emitted during parsing.")
    execution_time: float = Field(description="Calculated execution interval for the segmentation pipeline (seconds).")
