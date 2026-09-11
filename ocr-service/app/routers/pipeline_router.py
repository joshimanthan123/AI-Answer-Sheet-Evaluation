import asyncio
import cv2
import numpy as np
import base64
import logging
from typing import List, Union, Optional
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
    logger.info("OCR PREPROCESS: Request received - filename=%s", file.filename)
    content = await validate_uploaded_image(file, settings)
    logger.info("OCR PREPROCESS: Validation passed - bytes=%d", len(content))
    img = run_image_read_and_size_validation(content, preprocessor)
    
    preprocess_result = await asyncio.to_thread(preprocessor.preprocess, img, PreprocessConfig())
    logger.info("OCR PREPROCESS: Preprocessing complete")
    
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
    logger.info("OCR RECOGNIZE: Request received - filename=%s", file.filename)
    content = await validate_uploaded_image(file, settings)
    logger.info("OCR RECOGNIZE: File validation passed - content_size=%d bytes", len(content))
    
    img = run_image_read_and_size_validation(content, preprocessor)
    logger.info("OCR RECOGNIZE: Image decoding complete - shape=%s", img.shape)
    
    logger.info("OCR RECOGNIZE: Preprocessing started")
    preprocess_result = await asyncio.to_thread(preprocessor.preprocess, img, PreprocessConfig())
    logger.info("OCR RECOGNIZE: Preprocessing complete - processed_shape=%s", preprocess_result.processed.shape)
    
    logger.info("OCR RECOGNIZE: HWR inference started")
    try:
        hwr_result = await asyncio.to_thread(hwr_service.recognize_handwriting, preprocess_result.processed)
        logger.info("OCR RECOGNIZE: HWR inference complete - text_lines=%d, confidence=%.4f", len(hwr_result.lines), hwr_result.confidence)
    except HWRServiceError as hse:
        logger.error("OCR RECOGNIZE: HWR service failure: %s", str(hse))
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
    
    preprocess_result = await asyncio.to_thread(preprocessor.preprocess, img, PreprocessConfig())
    prep_time = preprocess_result.metadata["processing_time"]
    
    # 2. HWR
    try:
        hwr_result = await asyncio.to_thread(hwr_service.recognize_handwriting, preprocess_result.processed)
    except HWRServiceError as hse:
        if "timeout" in str(hse).lower() or "gate" in str(hse).lower():
            raise AzureTimeoutException(str(hse))
        raise OCRProviderFailureException(str(hse))
    hwr_time = hwr_result.execution_time
    
    # 3. Segment
    try:
        segment_result = await asyncio.to_thread(segmentation_service.segment_answers, hwr_result)
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


from pydantic import BaseModel, Field

class StrokePoint(BaseModel):
    x: float
    y: float

class Stroke(BaseModel):
    points: List[StrokePoint]
    color: str = "#0000FF"
    width: int = 3

class StrokesPayload(BaseModel):
    strokes: List[Stroke]
    width: Optional[int] = Field(default=800, alias="canvasWidth")
    height: Optional[int] = Field(default=600, alias="canvasHeight")
    page_num: int = 1
    
    class Config:
        populate_by_name = True

@router.post("/recognize-strokes", response_model=ApiResponse, tags=["Recognition"])
async def recognize_strokes(
    payload: StrokesPayload,
    hwr_service: HandwritingRecognitionService = Depends(get_hwr_service)
):
    """
    Renders student digital canvas strokes into a high-contrast white numpy image matrix
    with ink bounding box normalization, padding, dynamic line width scaling,
    saves structured diagnostic debug images, and evaluates results via OCRQualityGate.
    """
    import os
    from app.services.ocr_quality_gate import quality_gate

    debug_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug")
    os.makedirs(debug_dir, exist_ok=True)

    # 1. Collect points to calculate ink bounding box
    all_x = []
    all_y = []
    
    for stroke in payload.strokes:
        if not stroke.points:
            continue
        for pt in stroke.points:
            all_x.append(pt.x)
            all_y.append(pt.y)
            
    padding = 40
    target_height = 100
    
    if not all_x or not all_y:
        # Fallback to empty white canvas if no stroke points provided
        canvas_w = payload.width or 800
        canvas_h = payload.height or 400
        raw_img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
        upscaled_img = raw_img.copy()
        gray_img = cv2.cvtColor(raw_img, cv2.COLOR_BGR2GRAY)
        contrast_img = gray_img.copy()
        final_img = raw_img.copy()
    else:
        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)
        
        bbox_w = max(max_x - min_x, 10)
        bbox_h = max(max_y - min_y, 10)
        
        # 01. Render original raw canvas at 1:1 scale
        raw_w = int(bbox_w + padding * 2)
        raw_h = int(bbox_h + padding * 2)
        raw_img = np.ones((raw_h, raw_w, 3), dtype=np.uint8) * 255
        for stroke in payload.strokes:
            if not stroke.points or len(stroke.points) < 2:
                continue
            raw_pts = [(int(p.x - min_x + padding), int(p.y - min_y + padding)) for p in stroke.points]
            for i in range(len(raw_pts) - 1):
                cv2.line(raw_img, raw_pts[i], raw_pts[i+1], (0, 0, 0), stroke.width or 3, lineType=cv2.LINE_AA)

        # 02. Upscale with aspect-ratio preservation to target height
        scale = max(target_height / bbox_h, 1.0)
        max_canvas_w = 1600
        
        scaled_w = int(bbox_w * scale)
        scaled_h = int(bbox_h * scale)
        
        canvas_w = min(max(scaled_w + padding * 2, 400), max_canvas_w)
        canvas_h = scaled_h + padding * 2
        
        upscaled_img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
        stroke_w = max(int(round(4 * (scale ** 0.5))), 4)
        
        for stroke in payload.strokes:
            if not stroke.points or len(stroke.points) < 2:
                continue
            scaled_pts = []
            for p in stroke.points:
                sx = int((p.x - min_x) * scale + padding)
                sy = int((p.y - min_y) * scale + padding)
                scaled_pts.append((sx, sy))
            for i in range(len(scaled_pts) - 1):
                cv2.line(upscaled_img, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_w, lineType=cv2.LINE_AA)

        # 03. Grayscale
        gray_img = cv2.cvtColor(upscaled_img, cv2.COLOR_BGR2GRAY)
        
        # 04. Contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast_img = clahe.apply(gray_img)

        # 05. Final image for OCR
        final_img = upscaled_img.copy()

    # 2. Save diagnostic debug images
    cv2.imwrite(os.path.join(debug_dir, "01_original_canvas_render.png"), raw_img)
    cv2.imwrite(os.path.join(debug_dir, "02_upscaled.png"), upscaled_img)
    cv2.imwrite(os.path.join(debug_dir, "03_grayscale.png"), gray_img)
    cv2.imwrite(os.path.join(debug_dir, "04_contrast_enhanced.png"), contrast_img)
    cv2.imwrite(os.path.join(debug_dir, "05_final_ocr_input.png"), final_img)
    cv2.imwrite(os.path.join(debug_dir, "generated_student_handwriting.png"), final_img)
    logger.info("Saved diagnostic stroke pipeline debug images to %s", debug_dir)

    # 3. Transcribe handwriting
    try:
        hwr_result = await asyncio.to_thread(hwr_service.recognize_handwriting, final_img, page_num=payload.page_num)
        
        from app.services.hwr_postprocessor import postprocess_hwr_text
        raw_text = hwr_result.text
        proc_text = postprocess_hwr_text(raw_text)
        
        hwr_result.raw_text = raw_text
        hwr_result.processed_text = proc_text
        hwr_result.text = proc_text

        # 4. Evaluate quality gate
        qg_result = quality_gate.evaluate(proc_text, hwr_result.confidence, hwr_result.lines)
        hwr_result.ocrQualityStatus = qg_result.ocrQualityStatus
        hwr_result.needsReview = qg_result.needsReview
        hwr_result.qualityReasons = qg_result.qualityReasons

    except HWRServiceError as hse:
        if "timeout" in str(hse).lower() or "gate" in str(hse).lower():
            raise AzureTimeoutException(str(hse))
        raise OCRProviderFailureException(str(hse))
        
    return ApiResponse(
        success=True,
        message="Handwriting strokes recognized successfully.",
        data=hwr_result.model_dump()
    )


