from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.models.hwr_models import HWRResult
from app.models.segmentation_models import SegmentationResult

class PreprocessAPIResponse(BaseModel):
    """
    Serializable version of PreprocessResult mapping image binary data to base64.
    """
    original: str = Field(description="Base64 encoded string of the original image.")
    grayscale: Optional[str] = Field(default=None, description="Base64 encoded string of the grayscale image.")
    processed: str = Field(description="Base64 encoded string of the binarized/morphological processed image.")
    metadata: Dict[str, Any] = Field(description="Execution times and dimensions.")


class OCRPipelineMetrics(BaseModel):
    """
    Statistical counters mapping document segmentation metrics.
    """
    total_pages: int = Field(description="Total pages processed.")
    total_lines: int = Field(description="Total text lines transcribed.")
    total_answers: int = Field(description="Total answer blocks segmented.")
    average_confidence: float = Field(description="Overall average reading confidence.")


class OCRPipelineResponse(BaseModel):
    """
    Unified result sheet orchestrating all stages of the OCR pipeline.
    """
    request_id: str = Field(description="Traced request ID identifier.")
    preprocessing_time: float = Field(description="Duration of Preprocessing stage (seconds).")
    hwr_time: float = Field(description="Duration of Handwriting Recognition stage (seconds).")
    segmentation_time: float = Field(description="Duration of segmentation stage (seconds).")
    total_execution_time: float = Field(description="Combined pipeline roundtrip execution duration.")
    metrics: OCRPipelineMetrics = Field(description="Metrics counters of the execution run.")
    preprocessing: PreprocessAPIResponse = Field(description="Preprocessed Base64 image payload.")
    recognition: HWRResult = Field(description="Handwriting recognition text lines sheet.")
    segmentation: SegmentationResult = Field(description="Segmented answers output.")


class OCRHealthResponse(BaseModel):
    """
    Basic health check statistics report.
    """
    service: str = Field("ocr-service", description="Microservice name.")
    status: str = Field("healthy", description="Status code check.")
    provider: str = Field(description="Active configured HWR Provider name.")
    uptime: float = Field(description="Service uptime in seconds.")


class OCRVersionResponse(BaseModel):
    """
    Deployment version tracking payload.
    """
    service: str = Field("ocr-service", description="Microservice name.")
    version: str = Field("1.0.0", description="SemVer designation.")
    build: str = Field(description="VCS build commit hash or mock tag.")
    provider: str = Field(description="Active configured HWR Provider name.")
