import cv2
import numpy as np
import base64
import logging
from typing import List, Union
from fastapi import APIRouter, Depends, UploadFile, File, Request
from app.config import Settings
from app.dependencies import get_settings, get_preprocessor, get_hwr_service, get_segmentation_service
from app.services.preprocess_service import ImagePreprocessor, PreprocessConfig
from app.services.hwr_service import HandwritingRecognitionService, HWRServiceError
from app.services.segmentation_service import AnswerSegmentationService
from app.models.response_models import ApiResponse
from app.models.hwr_models import HWRResult
from app.models.segmentation_models import SegmentationResult
from app.models.api_models import (
    PreprocessAPIResponse, 
    OCRPipelineMetrics, 
    OCRPipelineResponse
)
from app.exception_handlers import (
    InvalidImageTypeException,
    FileTooLargeException,
    CorruptedImageException,
    OCRProviderFailureException,
    AzureTimeoutException,
    SegmentationFailureException,
    OCRServiceException
)

logger = logging.getLogger("app.routers.pipeline_router")

router = APIRouter(prefix="/api/v1/ocr")


def encode_to_base64(img_array) -> str:
    """Encodes OpenCV image array to base64 string."""
    try:
        _, buffer = cv2.imencode(".png", img_array)
        return base64.b64encode(buffer).decode("utf-8")
    except Exception as e:
        logger.exception("Failed to base64 encode processed image matrix.")
        raise CorruptedImageException("Failed to decode processed image matrix.") from e


async def validate_uploaded_image(file: UploadFile, settings: Settings) -> bytes:
    """Validates parameters of uploaded file (format, size limits)."""
    # 1. Validate file empty
    if not file.filename:
         raise OCRServiceException("Empty files upload detected.", "EMPTY_UPLOAD", 400)

    # 3. Size check limits
    content = await file.read()
    if len(content) == 0:
         raise OCRServiceException("Empty files upload detected.", "EMPTY_UPLOAD", 400)

    if file.content_type not in settings.OCR_ALLOWED_IMAGE_TYPES:
         raise InvalidImageTypeException(
             f"Unsupported image type. Allowed: {settings.OCR_ALLOWED_IMAGE_TYPES}"
         )
         
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.OCR_MAX_UPLOAD_SIZE_MB:
         raise FileTooLargeException(
             f"Uploaded image is {size_mb:.2f} MB, which exceeds {settings.OCR_MAX_UPLOAD_SIZE_MB} MB limit."
         )
         
    return content


def run_image_read_and_size_validation(content: bytes, preprocessor: ImagePreprocessor):
    """Loads image and validates spatial boundaries."""
    try:
        img = preprocessor.load(content)
    except Exception as e:
        raise CorruptedImageException("The uploaded file could not be parsed as an image.") from e
        
    h, w = img.shape[:2]
    if h > 8000 or w > 8000:
        raise OCRServiceException(
            f"Image dimensions ({w}x{h}) exceed the maximum allowed limit of 8000x8000 pixels.",
            "DIMENSIONS_TOO_LARGE",
            400
        )
    return img


@router.post("/preprocess", response_model=ApiResponse, tags=["Preprocessing"])
async def preprocess_image(
    file: UploadFile = File(..., description="Binary image file to process."),
    settings: Settings = Depends(get_settings),
    preprocessor: ImagePreprocessor = Depends(get_preprocessor)
):
    """
    Runs the OpenCV cleanup operations and returns Base64 representations.
    """
    content = await validate_uploaded_image(file, settings)
    img = run_image_read_and_size_validation(content, preprocessor)
    
    preprocess_result = preprocessor.preprocess(img, PreprocessConfig())
    
    orig_b64 = encode_to_base64(preprocess_result.original)
    proc_b64 = encode_to_base64(preprocess_result.processed)
    gray_b64 = encode_to_base64(preprocess_result.grayscale) if preprocess_result.grayscale is not None else None
    
    data = PreprocessAPIResponse(
        original=orig_b64,
        grayscale=gray_b64,
        processed=proc_b64,
        metadata=preprocess_result.metadata
    )
    
    return ApiResponse(
        success=True,
        message="Image preprocessing completed successfully.",
        data=data.model_dump()
    )


@router.post("/recognize", response_model=ApiResponse, tags=["Recognition"])
async def recognize_image(
    file: UploadFile = File(..., description="Handwritten image sheet to process."),
    settings: Settings = Depends(get_settings),
    preprocessor: ImagePreprocessor = Depends(get_preprocessor),
    hwr_service: HandwritingRecognitionService = Depends(get_hwr_service)
):
    """
    Preprocess image and transcribe handwritten text lines.
    """
    content = await validate_uploaded_image(file, settings)
    img = run_image_read_and_size_validation(content, preprocessor)
    
    preprocess_result = preprocessor.preprocess(img, PreprocessConfig())
    
    try:
        hwr_result = hwr_service.recognize_handwriting(preprocess_result.processed)
    except HWRServiceError as hse:
        if "timeout" in str(hse).lower() or "gate" in str(hse).lower():
            raise AzureTimeoutException(str(hse))
        raise OCRProviderFailureException(str(hse))
        
    return ApiResponse(
        success=True,
        message="Handwriting recognition completed successfully.",
        data=hwr_result.model_dump()
    )


@router.post("/segment", response_model=ApiResponse, tags=["Segmentation"])
def segment_transcripts(
    hwr_input: Union[HWRResult, List[HWRResult]],
    segmentation_service: AnswerSegmentationService = Depends(get_segmentation_service)
):
    """
    Detect question boundaries and compile answer blocks.
    """
    # Validate payload checks
    if isinstance(hwr_input, list):
         if not hwr_input:
              raise OCRServiceException("Payload list cannot be empty.", "INVALID_PAYLOAD", 400)
         for item in hwr_input:
              if not item.lines:
                   raise OCRServiceException("Input HWR result page contains no lines lists.", "INVALID_PAYLOAD", 400)
    else:
         if not hwr_input.lines:
              raise OCRServiceException("Input HWR result contains no lines lists.", "INVALID_PAYLOAD", 400)

    try:
        result = segmentation_service.segment_answers(hwr_input)
    except Exception as e:
        raise SegmentationFailureException(f"Segmentation failed during boundary parse: {str(e)}")
        
    return ApiResponse(
        success=True,
        message="Answer segmentation completed successfully.",
        data=result.model_dump()
    )


@router.post("/pipeline", response_model=ApiResponse, tags=["Pipeline"])
async def run_pipeline(
    request: Request,
    file: UploadFile = File(..., description="Answer sheet image to parse."),
    settings: Settings = Depends(get_settings),
    preprocessor: ImagePreprocessor = Depends(get_preprocessor),
    hwr_service: HandwritingRecognitionService = Depends(get_hwr_service),
    segmentation_service: AnswerSegmentationService = Depends(get_segmentation_service)
):
    """
    Executes Preprocessing -> Recognition -> Segmentation.
    """
    req_id = getattr(request.state, "request_id", "N/A")
    
    # 1. Preprocess
    content = await validate_uploaded_image(file, settings)
    img = run_image_read_and_size_validation(content, preprocessor)
    
    preprocess_result = preprocessor.preprocess(img, PreprocessConfig())
    prep_time = preprocess_result.metadata["processing_time"]
    
    # 2. HWR
    try:
        hwr_result = hwr_service.recognize_handwriting(preprocess_result.processed)
    except HWRServiceError as hse:
        if "timeout" in str(hse).lower() or "gate" in str(hse).lower():
            raise AzureTimeoutException(str(hse))
        raise OCRProviderFailureException(str(hse))
    hwr_time = hwr_result.execution_time
    
    # 3. Segment
    try:
        segment_result = segmentation_service.segment_answers(hwr_result)
    except Exception as e:
        raise SegmentationFailureException(f"Answer segmentation failed in pipeline: {str(e)}")
    seg_time = segment_result.execution_time
    
    # Metrics calculations
    total_time = prep_time + hwr_time + seg_time
    
    total_lines = len(hwr_result.lines)
    total_answers = len(segment_result.answers)
    
    if segment_result.answers:
         avg_conf = sum(a.confidence for a in segment_result.answers) / len(segment_result.answers)
    else:
         avg_conf = hwr_result.confidence
         
    metrics = OCRPipelineMetrics(
        total_pages=1, # Single image input represents one page
        total_lines=total_lines,
        total_answers=total_answers,
        average_confidence=round(avg_conf, 4)
    )
    
    orig_b64 = encode_to_base64(preprocess_result.original)
    proc_b64 = encode_to_base64(preprocess_result.processed)
    gray_b64 = encode_to_base64(preprocess_result.grayscale) if preprocess_result.grayscale is not None else None
    
    prep_api = PreprocessAPIResponse(
        original=orig_b64,
        grayscale=gray_b64,
        processed=proc_b64,
        metadata=preprocess_result.metadata
    )
    
    pipeline_res = OCRPipelineResponse(
        request_id=req_id,
        preprocessing_time=prep_time,
        hwr_time=hwr_time,
        segmentation_time=seg_time,
        total_execution_time=round(total_time, 4),
        metrics=metrics,
        preprocessing=prep_api,
        recognition=hwr_result,
        segmentation=segment_result
    )
    
    return ApiResponse(
        success=True,
        message="OCR pipeline processing completed successfully.",
        data=pipeline_res.model_dump()
    )


from pydantic import BaseModel

class StrokePoint(BaseModel):
    x: float
    y: float

class Stroke(BaseModel):
    points: List[StrokePoint]
    color: str = "#0000FF"
    width: int = 3

class StrokesPayload(BaseModel):
    strokes: List[Stroke]
    width: int = 800
    height: int = 600
    page_num: int = 1

@router.post("/recognize-strokes", response_model=ApiResponse, tags=["Recognition"])
async def recognize_strokes(
    payload: StrokesPayload,
    hwr_service: HandwritingRecognitionService = Depends(get_hwr_service)
):
    """
    Renders student digital canvas strokes into a clean white numpy image matrix
    with bounding box normalization and padding, saves diagnostic images,
    and performs handwriting recognition using the configured provider.
    """
    # 1. Collect points to calculate bounding box
    all_x = []
    all_y = []
    
    for stroke in payload.strokes:
        if not stroke.points:
            continue
        for pt in stroke.points:
            all_x.append(pt.x)
            all_y.append(pt.y)
            
    padding = 50
    target_min_height = 250
    stroke_thickness = 5
    
    if not all_x or not all_y:
        # Fallback to white canvas if empty
        img = np.ones((payload.height or 400, payload.width or 800, 3), dtype=np.uint8) * 255
    else:
        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)
        
        bbox_w = max(max_x - min_x, 10)
        bbox_h = max(max_y - min_y, 10)
        
        # Scale to ensure handwriting is clearly visible and reasonably sized
        scale = max(target_min_height / bbox_h, 1.5)
        
        canvas_w = int(bbox_w * scale + padding * 2)
        canvas_h = int(bbox_h * scale + padding * 2)
        
        img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
        
        for stroke in payload.strokes:
            if not stroke.points or len(stroke.points) < 2:
                continue
            
            scaled_pts = []
            for p in stroke.points:
                sx = int((p.x - min_x) * scale + padding)
                sy = int((p.y - min_y) * scale + padding)
                scaled_pts.append((sx, sy))
                
            for i in range(len(scaled_pts) - 1):
                cv2.line(img, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_thickness, lineType=cv2.LINE_AA)

    # 2. Save diagnostic debug images
    import os
    debug_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug")
    os.makedirs(debug_dir, exist_ok=True)
    
    out_png = os.path.join(debug_dir, "generated_student_handwriting.png")
    orig_png = os.path.join(debug_dir, "01-original.png")
    
    cv2.imwrite(out_png, img)
    cv2.imwrite(orig_png, img)
    logger.info("Saved diagnostic stroke image to %s", out_png)

    # 3. Transcribe handwriting
    try:
        hwr_result = hwr_service.recognize_handwriting(img, page_num=payload.page_num)
        
        from app.services.hwr_postprocessor import postprocess_hwr_text
        raw_text = hwr_result.text
        proc_text = postprocess_hwr_text(raw_text)
        
        hwr_result.raw_text = raw_text
        hwr_result.processed_text = proc_text
        hwr_result.text = proc_text
    except HWRServiceError as hse:
        if "timeout" in str(hse).lower() or "gate" in str(hse).lower():
            raise AzureTimeoutException(str(hse))
        raise OCRProviderFailureException(str(hse))
        
    return ApiResponse(
        success=True,
        message="Handwriting strokes recognized successfully.",
        data=hwr_result.model_dump()
    )

