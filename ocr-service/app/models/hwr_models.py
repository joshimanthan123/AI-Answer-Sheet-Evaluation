from pydantic import BaseModel, Field
from typing import List

class HWRLine(BaseModel):
    """
    Represents a single recognized line of handwritten text with an associated confidence core.
    """
    text: str = Field(description="The transcribed text content of the line.")
    confidence: float = Field(description="Confidence ranking of transcription accuracy (0.0 to 1.0).")
    boundingBox: list[list[int]] | list[int] | None = Field(default=None, description="Optional spatial bounding box of the line.")



class HWRResult(BaseModel):
    """
    A unified, provider-independent model representing the result of handwriting recognition on a document page.
    """
    text: str = Field(description="The complete block text reconstructed from all lanes.")
    raw_text: str | None = Field(default=None, description="The raw, uncorrected text directly from the HWR engine.")
    processed_text: str | None = Field(default=None, description="Context-corrected digital text.")
    confidence: float = Field(description="Average confidence across all recognized lines.")
    lines: List[HWRLine] = Field(description="Segmented lines of text preserving original reading order.")
    provider: str = Field(description="The name of the OCR engine that produced the result.")
    execution_time: float = Field(description="Time elapsed during the recognition process (seconds).")
