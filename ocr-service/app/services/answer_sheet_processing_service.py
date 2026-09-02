import os
import uuid
import logging
import traceback
from datetime import datetime, timezone
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import List, Optional

from app.config import settings
from app.core.exceptions import (
    AnswerSheetNotFound,
    UnsupportedAnswerSheetFormat,
    AnswerSheetTooLarge,
    AnswerSheetProcessingError,
    InvalidAnswerSheetFile
)
from app.models.answer_sheet_models import (
    AnswerSheetResponse,
    AnswerSheetPage,
    DigitalAnswer,
    AnswerSheetStatus
)
from app.models.hwr_models import HWRResult, HWRLine
from app.repositories.answer_sheet_repository import IAnswerSheetRepository
from app.storage.base_storage import IStorage
from app.services.preprocess_service import ImagePreprocessor, PreprocessConfig
from app.services.hwr_service import HandwritingRecognitionService
from app.services.segmentation_service import AnswerSegmentationService
from app.utils.confidence_utils import calculate_average_confidence, classify_confidence

logger = logging.getLogger("app.services.answer_sheet_processing_service")

class AnswerSheetProcessingService:
    """
    Orchestration service for managing the asynchronous lifecycle of answer sheets
    from ingestion, multi-page preprocessing, HWR/OCR transcription to segmented results.
    """
    def __init__(
        self,
        repository: IAnswerSheetRepository,
        storage: IStorage,
        preprocessor: ImagePreprocessor,
        hwr_service: HandwritingRecognitionService,
        segmentation_service: AnswerSegmentationService
    ) -> None:
        self.repository = repository
        self.storage = storage
        self.preprocessor = preprocessor
        self.hwr_service = hwr_service
        self.segmentation_service = segmentation_service

    def validate_file(self, filename: str, content: bytes, content_type: str | None = None) -> str:
        """Validates filename extension, MIME type, structure and file size limitations."""
        if not filename or len(content) == 0:
            raise InvalidAnswerSheetFile("Uploaded file context is empty.")

        # 1. Size check
        size_mb = len(content) / (1024 * 1024)
        if size_mb > settings.ANSWER_SHEET_MAX_UPLOAD_SIZE_MB:
            raise AnswerSheetTooLarge(
                f"File size {size_mb:.2f} MB exceeds maximum of {settings.ANSWER_SHEET_MAX_UPLOAD_SIZE_MB} MB."
            )

        # 2. Extension check
        ext = os.path.splitext(filename.lower())[1]
        if ext not in settings.ANSWER_SHEET_ALLOWED_EXTENSIONS:
            raise UnsupportedAnswerSheetFormat(f"Extension '{ext}' is not supported.")

        if not content_type:
            if ext == ".pdf":
                content_type = "application/pdf"
            elif ext in (".jpg", ".jpeg"):
                content_type = "image/jpeg"
            elif ext == ".png":
                content_type = "image/png"
            elif ext == ".webp":
                content_type = "image/webp"
            elif ext in (".tif", ".tiff"):
                content_type = "image/tiff"

        # 3. Content type and Magic Bytes Check
        is_pdf = content.startswith(b"%PDF")
        is_jpeg = content.startswith(b"\xff\xd8\xff")
        is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = content.startswith(b"RIFF") and content[8:12] == b"WEBP"
        is_tiff = content.startswith(b"II*\x00") or content.startswith(b"MM\x00*")

        if ext == ".pdf":
            if not is_pdf:
                raise InvalidAnswerSheetFile("Invalid PDF signature.")
        elif ext in (".jpg", ".jpeg"):
            if not is_jpeg:
                raise InvalidAnswerSheetFile("Invalid JPEG signature.")
        elif ext == ".png":
            if not is_png:
                raise InvalidAnswerSheetFile("Invalid PNG signature.")
        elif ext == ".webp":
            if not is_webp:
                raise InvalidAnswerSheetFile("Invalid WEBP signature.")
        elif ext in (".tif", ".tiff"):
            if not is_tiff:
                raise InvalidAnswerSheetFile("Invalid TIFF signature.")
        else:
            raise UnsupportedAnswerSheetFormat("Unsupported format.")
            
        return ext

    async def enqueue_for_processing(
        self,
        student_id: str,
        exam_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
        sheet_id: str | None = None
    ) -> AnswerSheetResponse:
        """
        Validates the uploaded file, saves it, creates a database record with state QUEUED,
        and enqueues the processing background execution block.
        """
        student_id = "".join([c for c in student_id if c.isalnum() or c in ("-", "_")])
        exam_id = "".join([c for c in exam_id if c.isalnum() or c in ("-", "_")])
        safe_filename = os.path.basename(filename)
        
        if not student_id or not exam_id or not safe_filename:
            raise InvalidAnswerSheetFile("Invalid fields provided for answer sheet.")
            
        ext = self.validate_file(safe_filename, content, content_type)
        
        if not sheet_id:
            sheet_id = str(uuid.uuid4())
        else:
            sheet_id = str(sheet_id)
            
        now = datetime.now(timezone.utc)
        orig_upload_ref = f"{student_id}/{sheet_id}/original/source{ext}"

        # Initialize queued database record
        sheet_res = AnswerSheetResponse(
            id=sheet_id,
            student_id=student_id,
            exam_id=exam_id,
            original_filename=safe_filename,
            original_format=ext.lstrip('.').upper(),
            file_size=len(content),
            page_count=0,
            processing_status=AnswerSheetStatus.QUEUED,
            pages=[],
            digital_answers=[],
            uploaded_at=now,
            updated_at=now,
            processing_progress=0,
            current_step="Queued",
            queued_at=now,
            processing_attempt=0,
            processing_history=[]
        )
        
        await self.repository.create(sheet_res)

        try:
            self.storage.upload(orig_upload_ref, content)
        except Exception as e:
            logger.error("Failed to upload original answer sheet during enqueuing: %s", str(e))
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.FAILED,
                "current_step": "Failed",
                "error_message": f"Storage upload failed: {str(e)}",
                "processing_failed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            })
            raise AnswerSheetProcessingError(f"Storage upload failed: {str(e)}")

        return sheet_res

    async def process_sheet_task(self, sheet_id: str) -> None:
        """
        Background task running the full processing pipeline for an answer sheet.
        Loads original binary, splits to pages, preprocesses, HWR transcribe, and group-segments.
        """
        start_time = datetime.now(timezone.utc)
        logger.info("Starting background processing pipeline for sheet: %s", sheet_id)
        
        sheet = await self.repository.get(sheet_id)
        if not sheet:
            logger.error("Answer sheet %s not found in repository during background task.", sheet_id)
            return

        current_progress = 0
        try:
            # Concurrency check / reprocessing history tracking
            # If the status is already active, log warning but proceed or overwrite
            history = list(sheet.processing_history) if sheet.processing_history else []
            if sheet.processing_attempt > 0:
                # Add existing state description as a history log
                history_entry = {
                    "attempt": sheet.processing_attempt,
                    "status": str(sheet.processing_status.value),
                    "progress": sheet.processing_progress,
                    "current_step": sheet.current_step,
                    "error_message": sheet.error_message,
                    "queued_at": sheet.queued_at.isoformat() if sheet.queued_at else None,
                    "started_at": sheet.processing_started_at.isoformat() if sheet.processing_started_at else None,
                    "completed_at": sheet.processing_completed_at.isoformat() if sheet.processing_completed_at else None,
                    "failed_at": sheet.processing_failed_at.isoformat() if sheet.processing_failed_at else None
                }
                history.append(history_entry)

            attempt = sheet.processing_attempt + 1
            
            # Step 1: Preprocessing Setup
            current_progress = 10
            sheet = await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.PREPROCESSING,
                "processing_progress": current_progress,
                "current_step": "Preprocessing",
                "processing_started_at": start_time,
                "processing_attempt": attempt,
                "processing_history": history,
                "error_message": None,
                "error_details": None,
                "updated_at": datetime.now(timezone.utc)
            })

            # Retrieve original file bytes from storage
            ext = "." + sheet.original_format.lower()
            orig_upload_ref = f"{sheet.student_id}/{sheet.id}/original/source{ext}"
            content = self.storage.download(orig_upload_ref)
            if not content:
                raise ValueError("Original source file could not be downloaded from storage.")

            # Render pages if PDF
            pages_data = []
            if ext == ".pdf":
                try:
                    pdf_doc = fitz.open(stream=content, filetype="pdf")
                    page_count = len(pdf_doc)
                    if page_count == 0:
                        raise ValueError("PDF content holds no pages.")
                    for page_num in range(page_count):
                        page = pdf_doc.load_page(page_num)
                        pix = page.get_pixmap()
                        png_bytes = pix.tobytes("png")
                        
                        orig_cv_img = self.preprocessor.load(png_bytes)
                        if orig_cv_img is None:
                            raise ValueError(f"Failed to load PDF page {page_num + 1} as OpenCV image.")
                        h, w = orig_cv_img.shape[:2]
                        pages_data.append((page_num + 1, png_bytes, w, h))
                except Exception as e:
                    raise AnswerSheetProcessingError(f"PDF page rendering failed: {str(e)}")
            else:
                orig_cv_img = self.preprocessor.load(content)
                if orig_cv_img is None:
                    raise ValueError("Failed to parse original image bytes.")
                h, w = orig_cv_img.shape[:2]
                
                # Convert to normalized original page PNG representation
                _, png_buffer = cv2.imencode(".png", orig_cv_img)
                png_bytes = png_buffer.tobytes()
                pages_data.append((1, png_bytes, w, h))

            await self.repository.update(sheet_id, {
                "page_count": len(pages_data)
            })

            final_pages = []
            hwr_results_by_page = []

            # Step 2: Preprocess & OCR Pages
            total_pages = len(pages_data)
            for idx, (page_num, img_bytes, w, h) in enumerate(pages_data):
                # Update progress for preprocessing: 10% to 30% range
                current_progress = 10 + int((idx / total_pages) * 20)
                await self.repository.update(sheet_id, {
                    "processing_progress": current_progress,
                    "current_step": f"Preprocessing Page {page_num}/{total_pages}"
                })

                page_started = datetime.now(timezone.utc)
                orig_page_ref = f"{sheet.student_id}/{sheet.id}/original/page-{page_num:03d}.png"
                processed_page_ref = f"{sheet.student_id}/{sheet.id}/processed/page-{page_num:03d}.png"
                
                self.storage.upload(orig_page_ref, img_bytes)

                # Preprocess image copy
                orig_cv_img = self.preprocessor.load(img_bytes)
                preprocess_result = self.preprocessor.preprocess(orig_cv_img, PreprocessConfig())

                _, processed_buffer = cv2.imencode(".png", preprocess_result.processed)
                processed_bytes = processed_buffer.tobytes()
                self.storage.upload(processed_page_ref, processed_bytes)

                # Build page metadata
                page_obj = AnswerSheetPage(
                    page_number=page_num,
                    original_file_reference=orig_page_ref,
                    processed_file_reference=processed_page_ref,
                    width=w,
                    height=h,
                    processing_status="PROCESSED",
                    preprocessing_metadata={
                        "contrast_metric": getattr(preprocess_result, "contrast", 0.0),
                        "skew_angle": getattr(preprocess_result, "skew_angle", 0.0)
                    },
                    processing_started_at=page_started
                )
                final_pages.append(page_obj)

            # Update pages in DB
            sheet = await self.repository.update(sheet_id, {
                "pages": final_pages,
                "processing_status": AnswerSheetStatus.OCR_PROCESSING,
                "current_step": "OCR Transcription"
            })

            # Run OCR/HWR page by page
            for idx, page_obj in enumerate(final_pages):
                page_num = page_obj.page_number
                
                # Update progress for OCR processing: 30% to 75% range
                current_progress = 30 + int((idx / total_pages) * 45)
                await self.repository.update(sheet_id, {
                    "processing_progress": current_progress,
                    "current_step": f"OCR Transcription Page {page_num}/{total_pages}"
                })

                processed_page_ref = page_obj.processed_file_reference
                processed_bytes = self.storage.download(processed_page_ref)
                processed_cv_img = self.preprocessor.load(processed_bytes)

                try:
                    # Run HWR recognition
                    hwr_result = self.hwr_service.recognize_handwriting(processed_cv_img, page_num=page_num)
                    
                    page_completed = datetime.now(timezone.utc)
                    all_confs = [line.confidence for line in hwr_result.lines]
                    avg_conf = calculate_average_confidence(all_confs) or 0.0
                    conf_level = classify_confidence(avg_conf)

                    # Update page object properties on success
                    page_obj.extracted_text = hwr_result.text
                    page_obj.average_confidence = avg_conf
                    page_obj.confidence_level = conf_level
                    page_obj.lines = [
                        {
                            "text": l.text,
                            "confidence": l.confidence,
                            "boundingBox": l.boundingBox
                        }
                        for l in hwr_result.lines
                    ]
                    page_obj.processing_status = "COMPLETED"
                    page_obj.processing_completed_at = page_completed
                    
                    hwr_results_by_page.append(hwr_result)
                except Exception as e:
                    logger.error("Recoverable page transcription failed on page %d: %s", page_num, str(e))
                    page_obj.processing_status = "FAILED"
                    page_obj.error = {
                        "message": str(e),
                        "details": traceback.format_exc(),
                        "failed_at": datetime.now(timezone.utc).isoformat()
                    }
                    # Provide an empty result to avoid breakages downstream, keeping order
                    hwr_results_by_page.append(HWRResult(text="", confidence=0.0, lines=[], provider="fallback", execution_time=0.0))

            # Push page-level HWR results/statistics
            sheet = await self.repository.update(sheet_id, {
                "pages": final_pages
            })

            # Check if all pages failed
            all_pages_failed = all(p.processing_status == "FAILED" for p in final_pages)
            if all_pages_failed:
                raise ValueError("All pages failed OCR transcription.")

            # Step 3: Question Segmentation
            current_progress = 75
            sheet = await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.SEGMENTING,
                "processing_progress": current_progress,
                "current_step": "Question Segmentation"
            })

            logger.info("Running segmentation on %d pages for sheet: %s", len(hwr_results_by_page), sheet_id)
            segmentation_result = self.segmentation_service.segment_answers(hwr_results_by_page)
            
            # Progress 90%
            current_progress = 90
            await self.repository.update(sheet_id, {
                "processing_progress": current_progress,
                "current_step": "Finalizing digital answers"
            })

            # Step 4: Map Segmentation Results to Digital Answers Schema
            digital_answers = []
            for segmented_ans in segmentation_result.answers:
                digital_ans = DigitalAnswer(
                    question_number=segmented_ans.normalized_question_number,
                    text=segmented_ans.answer_text,
                    page_number=segmented_ans.metadata.page_start,
                    confidence=segmented_ans.confidence,
                    normalized_question_number=segmented_ans.normalized_question_number,
                    answer_text=segmented_ans.answer_text,
                    source_pages=segmented_ans.source_pages,
                    confidence_level=segmented_ans.confidence_level,
                    status=segmented_ans.status,
                    metadata={
                        "start_line": segmented_ans.start_line,
                        "end_line": segmented_ans.end_line,
                        "line_count": segmented_ans.metadata.line_count,
                        "original_header": segmented_ans.original_header
                    }
                )
                digital_answers.append(digital_ans)

            # Step 5: Complete
            now = datetime.now(timezone.utc)
            await self.repository.update(sheet_id, {
                "digital_answers": digital_answers,
                "processing_status": AnswerSheetStatus.COMPLETED,
                "processing_progress": 100,
                "current_step": "Completed",
                "processing_completed_at": now,
                "updated_at": now
            })
            logger.info("Background processing pipeline completed successfully for sheet: %s", sheet_id)

        except Exception as e:
            logger.exception("Catastrophic failure in sheet processing background task for: %s", sheet_id)
            now = datetime.now(timezone.utc)
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.FAILED,
                "processing_progress": min(current_progress, 99),
                "current_step": "Failed",
                "processing_failed_at": now,
                "error_message": str(e),
                "error_details": traceback.format_exc(),
                "updated_at": now
            })

    async def reprocess_sheet(self, sheet_id: str) -> None:
        """
        Triggers reprocessing of the entire answer sheet. Sets state back to QUEUED
        and enqueues the process_sheet_task.
        """
        sheet = await self.repository.get(sheet_id)
        if not sheet:
            raise AnswerSheetNotFound(f"Answer sheet '{sheet_id}' not found.")

        # Set status back to QUEUED and reset dates/errors, keeping history/attempt count
        now = datetime.now(timezone.utc)
        await self.repository.update(sheet_id, {
            "processing_status": AnswerSheetStatus.QUEUED,
            "processing_progress": 0,
            "current_step": "Queued for reprocessing",
            "queued_at": now,
            "error_message": None,
            "error_details": None,
            "updated_at": now
        })

    async def reprocess_page(self, sheet_id: str, page_number: int) -> None:
        """
        Reprocesses a specific page, re-running OCR and then re-running
        segmentation across the entire document sequence.
        """
        sheet = await self.repository.get(sheet_id)
        if not sheet:
            raise AnswerSheetNotFound(f"Answer sheet '{sheet_id}' not found.")

        # Find target page
        target_page = None
        for page in sheet.pages:
            if page.page_number == page_number:
                target_page = page
                break

        if not target_page:
            raise AnswerSheetProcessingError(f"Page {page_number} not found in sheet '{sheet_id}'.")

        # Record attempt & append to history
        history = list(sheet.processing_history) if sheet.processing_history else []
        history_entry = {
            "attempt": sheet.processing_attempt,
            "status": str(sheet.processing_status.value),
            "progress": sheet.processing_progress,
            "current_step": f"Reprocess page {page_number}",
            "error_message": sheet.error_message,
            "queued_at": sheet.queued_at.isoformat() if sheet.queued_at else None,
            "started_at": sheet.processing_started_at.isoformat() if sheet.processing_started_at else None,
            "completed_at": sheet.processing_completed_at.isoformat() if sheet.processing_completed_at else None,
            "failed_at": sheet.processing_failed_at.isoformat() if sheet.processing_failed_at else None
        }
        history.append(history_entry)

        attempt = sheet.processing_attempt + 1
        now = datetime.now(timezone.utc)

        # Update sheet status to OCR_PROCESSING
        await self.repository.update(sheet_id, {
            "processing_status": AnswerSheetStatus.OCR_PROCESSING,
            "processing_progress": 40,
            "current_step": f"OCR Reprocessing Page {page_number}",
            "processing_started_at": now,
            "processing_attempt": attempt,
            "processing_history": history,
            "error_message": None,
            "error_details": None,
            "updated_at": now
        })

        try:
            # Re-read and preprocess page
            orig_page_ref = target_page.original_file_reference
            processed_page_ref = target_page.processed_file_reference

            img_bytes = self.storage.download(orig_page_ref)
            orig_cv_img = self.preprocessor.load(img_bytes)
            preprocess_result = self.preprocessor.preprocess(orig_cv_img, PreprocessConfig())

            _, processed_buffer = cv2.imencode(".png", preprocess_result.processed)
            processed_bytes = processed_buffer.tobytes()
            self.storage.upload(processed_page_ref, processed_bytes)

            tag_started = datetime.now(timezone.utc)
            target_page.processing_started_at = tag_started
            target_page.processing_status = "PROCESSED"
            target_page.error = None

            # Re-run HWR
            hwr_result = self.hwr_service.recognize_handwriting(preprocess_result.processed, page_num=page_number)
            tag_completed = datetime.now(timezone.utc)

            all_confs = [line.confidence for line in hwr_result.lines]
            avg_conf = calculate_average_confidence(all_confs) or 0.0
            conf_level = classify_confidence(avg_conf)

            # Update page properties
            target_page.extracted_text = hwr_result.text
            target_page.average_confidence = avg_conf
            target_page.confidence_level = conf_level
            target_page.lines = [
                {
                    "text": l.text,
                    "confidence": l.confidence,
                    "boundingBox": l.boundingBox
                }
                for l in hwr_result.lines
            ]
            target_page.processing_status = "COMPLETED"
            target_page.processing_completed_at = tag_completed

            # Commit page updates
            await self.repository.update(sheet_id, {
                "pages": sheet.pages
            })

            # Check if any page is still FAILED
            # We construct page HWR results for all pages to recompute segmentation
            hwr_results_by_page = []
            for p in sheet.pages:
                if p.processing_status == "COMPLETED":
                    lines = [
                        HWRLine(text=l["text"], confidence=l["confidence"], boundingBox=l.get("boundingBox"))
                        for l in p.lines
                    ]
                    hwr_results_by_page.append(HWRResult(
                        text=p.extracted_text or "",
                        confidence=p.average_confidence or 0.0,
                        lines=lines,
                        provider="saved",
                        execution_time=0.0
                    ))
                else:
                    hwr_results_by_page.append(HWRResult(text="", confidence=0.0, lines=[], provider="fallback", execution_time=0.0))

            # Run Segmentation again
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.SEGMENTING,
                "processing_progress": 80,
                "current_step": "Re-segmenting answers"
            })

            segmentation_result = self.segmentation_service.segment_answers(hwr_results_by_page)

            # Map results
            digital_answers = []
            for segmented_ans in segmentation_result.answers:
                digital_ans = DigitalAnswer(
                    question_number=segmented_ans.normalized_question_number,
                    text=segmented_ans.answer_text,
                    page_number=segmented_ans.metadata.page_start,
                    confidence=segmented_ans.confidence,
                    normalized_question_number=segmented_ans.normalized_question_number,
                    answer_text=segmented_ans.answer_text,
                    source_pages=segmented_ans.source_pages,
                    confidence_level=segmented_ans.confidence_level,
                    status=segmented_ans.status,
                    metadata={
                        "start_line": segmented_ans.start_line,
                        "end_line": segmented_ans.end_line,
                        "line_count": segmented_ans.metadata.line_count,
                        "original_header": segmented_ans.original_header
                    }
                )
                digital_answers.append(digital_ans)

            # Complete re-processing
            comp_now = datetime.now(timezone.utc)
            await self.repository.update(sheet_id, {
                "digital_answers": digital_answers,
                "processing_status": AnswerSheetStatus.COMPLETED,
                "processing_progress": 100,
                "current_step": "Completed",
                "processing_completed_at": comp_now,
                "updated_at": comp_now
            })
            logger.info("Page reprocess task completed successfully for sheet %s page %d", sheet_id, page_number)

        except Exception as e:
            logger.exception("Failure in page reprocessing task for sheet %s page %d", sheet_id, page_number)
            fail_now = datetime.now(timezone.utc)
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.FAILED,
                "processing_progress": 99,
                "current_step": "Failed",
                "processing_failed_at": fail_now,
                "error_message": str(e),
                "error_details": traceback.format_exc(),
                "updated_at": fail_now
            })
