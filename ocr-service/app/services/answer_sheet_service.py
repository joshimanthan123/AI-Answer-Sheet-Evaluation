import os
import uuid
import logging
from datetime import datetime, timezone
from uuid import UUID
import fitz # PyMuPDF
import cv2
import numpy as np

from app.config import settings
from app.core.exceptions import (
    AnswerSheetNotFound,
    UnsupportedAnswerSheetFormat,
    AnswerSheetTooLarge,
    AnswerSheetProcessingError,
    AnswerSheetAccessDenied,
    AnswerSheetPageNotFound,
    InvalidAnswerSheetFile
)
from app.models.answer_sheet_models import (
    AnswerSheetResponse,
    AnswerSheetPage,
    DigitalAnswer,
    AnswerSheetStatus
)
from app.repositories.answer_sheet_repository import IAnswerSheetRepository
from app.storage.base_storage import IStorage
from app.services.preprocess_service import ImagePreprocessor, PreprocessConfig
from app.services.hwr_service import HandwritingRecognitionService
from app.services.segmentation_service import AnswerSegmentationService

logger = logging.getLogger("app.services.answer_sheet_service")

class AnswerSheetService:
    """
    Service layer orchestrator for answer sheets uploads, file conversions, 
    preprocessing steps, HWR recognition, and question boundary segmentation.
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
            if content_type != "application/pdf":
                raise UnsupportedAnswerSheetFormat("MIME type mismatch for PDF.")
        elif ext in (".jpg", ".jpeg"):
            if not is_jpeg:
                raise InvalidAnswerSheetFile("Invalid JPEG signature.")
            if content_type not in ("image/jpeg", "image/jpg"):
                raise UnsupportedAnswerSheetFormat("MIME type mismatch for JPEG.")
        elif ext == ".png":
            if not is_png:
                raise InvalidAnswerSheetFile("Invalid PNG signature.")
            if content_type != "image/png":
                raise UnsupportedAnswerSheetFormat("MIME type mismatch for PNG.")
        elif ext == ".webp":
            if not is_webp:
                raise InvalidAnswerSheetFile("Invalid WEBP signature.")
            if content_type != "image/webp":
                raise UnsupportedAnswerSheetFormat("MIME type mismatch for WEBP.")
        elif ext in (".tif", ".tiff"):
            if not is_tiff:
                raise InvalidAnswerSheetFile("Invalid TIFF signature.")
            if content_type not in ("image/tiff", "image/x-tiff"):
                raise UnsupportedAnswerSheetFormat("MIME type mismatch for TIFF.")
        else:
            raise UnsupportedAnswerSheetFormat("Unsupported format.")
            
        return ext

    async def process_answer_sheet(
        self,
        student_id: str,
        exam_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None
    ) -> AnswerSheetResponse:
        """Executes full files ingestion: renders pdf pages, runs image preprocess, HWR, and splits text blocks."""
        # Sanitize path keys against traversal payloads
        student_id = "".join([c for c in student_id if c.isalnum() or c in ("-", "_")])
        exam_id = "".join([c for c in exam_id if c.isalnum() or c in ("-", "_")])
        safe_filename = os.path.basename(filename)
        
        if not student_id or not exam_id or not safe_filename:
            raise InvalidAnswerSheetFile("Invalid fields provided for answer sheet.")
            
        ext = self.validate_file(safe_filename, content, content_type)
        sheet_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        # Build target file path paths
        orig_upload_ref = f"{student_id}/{sheet_id}/original/source{ext}"

        # Initialize base record
        sheet_res = AnswerSheetResponse(
            id=sheet_id,
            student_id=student_id,
            exam_id=exam_id,
            original_filename=safe_filename,
            original_format=ext.lstrip('.').upper(),
            file_size=len(content),
            page_count=0,
            processing_status=AnswerSheetStatus.PROCESSING,
            pages=[],
            digital_answers=[],
            uploaded_at=now,
            updated_at=now
        )
        await self.repository.create(sheet_res)

        # Save the original file untouched
        try:
            self.storage.upload(orig_upload_ref, content)
        except Exception as e:
            logger.error("Failed to upload original answer sheet: %s", str(e))
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.FAILED,
                "updated_at": datetime.now(timezone.utc)
            })
            raise AnswerSheetProcessingError(f"Storage upload failed: {str(e)}")

        pages_data = []

        try:
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
                    logger.error("PyMuPDF extraction failed: %s", str(e))
                    raise AnswerSheetProcessingError(f"PDF extraction failed: {str(e)}")
            else:
                try:
                    orig_cv_img = self.preprocessor.load(content)
                    if orig_cv_img is None:
                        raise ValueError("Failed to parse image bytes.")
                    h, w = orig_cv_img.shape[:2]
                    
                    # Convert to normalized original page PNG representation
                    _, png_buffer = cv2.imencode(".png", orig_cv_img)
                    png_bytes = png_buffer.tobytes()
                    
                    pages_data.append((1, png_bytes, w, h))
                except Exception as e:
                    logger.error("Image loading failed: %s", str(e))
                    raise AnswerSheetProcessingError(f"Image parsing failed: {str(e)}")

            await self.repository.update(sheet_id, {
                "page_count": len(pages_data),
                "processing_status": AnswerSheetStatus.PROCESSING
            })

            hwr_results_by_page = []
            final_pages = []

            for page_num, img_bytes, w, h in pages_data:
                # Store original page PNG representation
                orig_page_ref = f"{student_id}/{sheet_id}/original/page-{page_num:03d}.png"
                processed_page_ref = f"{student_id}/{sheet_id}/processed/page-{page_num:03d}.png"
                
                # Assert storage isolation path matches
                assert orig_page_ref != processed_page_ref, "Original and processed references overlap."
                
                self.storage.upload(orig_page_ref, img_bytes)

                # Preprocess image copy
                orig_cv_img = self.preprocessor.load(img_bytes)
                preprocess_result = self.preprocessor.preprocess(orig_cv_img, PreprocessConfig())

                _, processed_buffer = cv2.imencode(".png", preprocess_result.processed)
                processed_bytes = processed_buffer.tobytes()

                self.storage.upload(processed_page_ref, processed_bytes)

                page_obj = AnswerSheetPage(
                    page_number=page_num,
                    original_file_reference=orig_page_ref,
                    processed_file_reference=processed_page_ref,
                    width=w,
                    height=h,
                    processing_status="PROCESSED"
                )
                final_pages.append(page_obj)

                # Run HWR recognition on the processed page copy
                hwr_result = self.hwr_service.recognize_handwriting(preprocess_result.processed, page_num=page_num)
                logger.info(
                    "AnswerSheet %s. Page %d: HWR recognized lines count = %d",
                    str(sheet_id),
                    page_num,
                    len(hwr_result.lines)
                )
                hwr_results_by_page.append((page_num, hwr_result))

            await self.repository.update(sheet_id, {
                "pages": final_pages,
                "processing_status": AnswerSheetStatus.OCR_COMPLETED
            })

            # Run Question Segmentation
            segmentation_input = []
            for _, hwr_res in hwr_results_by_page:
                segmentation_input.append(hwr_res)

            logger.info("AnswerSheet %s: Running segmentation on %d pages", str(sheet_id), len(segmentation_input))
            segmentation_result = self.segmentation_service.segment_answers(segmentation_input)
            logger.info("AnswerSheet %s: Segmentation returned %d answers", str(sheet_id), len(segmentation_result.answers))

            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.SEGMENTED
            })

            # Collate digital answers map using the correct original page number
            digital_answers = []
            for segmented_ans in segmentation_result.answers:
                page_start = segmented_ans.metadata.page_start
                digital_ans = DigitalAnswer(
                    question_number=segmented_ans.normalized_question_number,
                    text=segmented_ans.answer_text,
                    page_number=page_start,
                    confidence=segmented_ans.confidence
                )
                digital_answers.append(digital_ans)
                logger.info(
                    "AnswerSheet %s: Created DigitalAnswer for %s (mapped starting page = %d)",
                    str(sheet_id),
                    segmented_ans.normalized_question_number,
                    page_start
                )

            logger.info("AnswerSheet %s: Total compiled DigitalAnswers count = %d", str(sheet_id), len(digital_answers))

            updated_sheet = await self.repository.update(sheet_id, {
                "digital_answers": digital_answers,
                "processing_status": AnswerSheetStatus.EVALUATION_PENDING,
                "updated_at": datetime.now(timezone.utc)
            })
            return updated_sheet

        except Exception as e:
            logger.exception("Failed executing sheet processing.")
            await self.repository.update(sheet_id, {
                "processing_status": AnswerSheetStatus.FAILED,
                "updated_at": datetime.now(timezone.utc)
            })
            raise AnswerSheetProcessingError(f"Answer sheet processing pipeline failed: {str(e)}")

    async def get_answer_sheet(self, sheet_id: UUID) -> AnswerSheetResponse:
        sheet = await self.repository.get(sheet_id)
        if not sheet:
            raise AnswerSheetNotFound(f"Answer sheet '{sheet_id}' not found.")
        return sheet

    async def list_answer_sheets(self, student_id: str = None, exam_id: str = None) -> list[AnswerSheetResponse]:
        sheets = await self.repository.list()
        if student_id:
            sheets = [s for s in sheets if s.student_id == student_id]
        if exam_id:
            sheets = [s for s in sheets if s.exam_id == exam_id]
        return sheets

    async def delete_answer_sheet(self, sheet_id: UUID) -> bool:
        sheet = await self.repository.get(sheet_id)
        if not sheet:
            raise AnswerSheetNotFound(f"Answer sheet '{sheet_id}' was not found.")
        
        ext = os.path.splitext(sheet.original_filename)[1]
        orig_upload_ref = f"{sheet.student_id}/{sheet_id}/original/source{ext}"
        self.storage.delete(orig_upload_ref)

        for page in sheet.pages:
            self.storage.delete(page.original_file_reference)
            self.storage.delete(page.processed_file_reference)

        return await self.repository.delete(sheet_id)

    def get_page_file(self, sheet: AnswerSheetResponse, page_number: int, type_str: str) -> bytes:
        """Downloads page binary image from storage."""
        target_page = None
        for page in sheet.pages:
            if page.page_number == page_number:
                target_page = page
                break
        
        if not target_page:
            raise AnswerSheetPageNotFound(f"Page {page_number} not found in sheet {sheet.id}.")
        
        ref = target_page.original_file_reference if type_str == "original" else target_page.processed_file_reference
        return self.storage.download(ref)
