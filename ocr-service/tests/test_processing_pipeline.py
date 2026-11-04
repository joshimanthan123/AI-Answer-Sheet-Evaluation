import os
import sys
import unittest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import fitz
import numpy as np

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.core.exceptions import (
    UnsupportedAnswerSheetFormat,
    AnswerSheetTooLarge,
    InvalidAnswerSheetFile,
    AnswerSheetProcessingError,
)
from app.models.answer_sheet_models import AnswerSheetStatus, AnswerSheetPage, DigitalAnswer
from app.services.local_storage import LocalStorage
from app.services.answer_sheet_processing_service import AnswerSheetProcessingService
from app.models.hwr_models import HWRResult, HWRLine
from app.models.segmentation_models import SegmentedAnswer, AnswerMetadata, SegmentationResult


class TestAnswerSheetProcessingPipeline(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage = LocalStorage(root_dir=Path(self.test_dir))
        self.mock_repo = AsyncMock()
        self.mock_preprocessor = MagicMock()
        self.mock_hwr = MagicMock()
        self.mock_segmentation = MagicMock()
        
        # Patch settings ANSWER_SHEET_MAX_UPLOAD_SIZE_MB to 20MB
        self.patcher = patch("app.services.answer_sheet_processing_service.settings")
        self.mock_settings = self.patcher.start()
        self.mock_settings.ANSWER_SHEET_STORAGE_DIR = Path(self.test_dir)
        self.mock_settings.ANSWER_SHEET_MAX_UPLOAD_SIZE_MB = 20
        self.mock_settings.ANSWER_SHEET_ALLOWED_EXTENSIONS = [
            ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"
        ]

        self.processing_service = AnswerSheetProcessingService(
            repository=self.mock_repo,
            storage=self.storage,
            preprocessor=self.mock_preprocessor,
            hwr_service=self.mock_hwr,
            segmentation_service=self.mock_segmentation,
        )

        # Generate a dummy 1-page PDF using PyMuPDF (fitz)
        doc = fitz.open()
        p = doc.new_page(width=100, height=200)
        p.draw_line((0, 0), (10, 10))
        self.valid_pdf_bytes = doc.write()

        # Dummy JPEG bytes
        self.valid_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"

    def tearDown(self):
        self.patcher.stop()
        shutil.rmtree(self.test_dir)

    async def test_enqueue_for_processing_success(self):
        self.mock_repo.create.return_value = None
        
        sheet = await self.processing_service.enqueue_for_processing(
            student_id="student-1",
            exam_id="exam-2",
            filename="sheet.pdf",
            content=self.valid_pdf_bytes,
        )
        
        self.assertEqual(sheet.processing_status, AnswerSheetStatus.QUEUED)
        self.assertEqual(sheet.processing_progress, 0)
        self.assertEqual(sheet.current_step, "Queued")
        self.mock_repo.create.assert_called_once()
        self.assertTrue(self.storage.exists(f"student-1/{sheet.id}/original/source.pdf"))

    async def test_process_sheet_task_success(self):
        # Setup mocks
        sheet_id = "test-sheet-id"
        mock_sheet = MagicMock(
            id=sheet_id,
            student_id="student-1",
            exam_id="exam-2",
            original_filename="sheet.pdf",
            original_format="PDF",
            processing_status=AnswerSheetStatus.QUEUED,
            processing_progress=0,
            current_step="Queued",
            processing_attempt=0,
            processing_history=[]
        )
        self.mock_repo.get.return_value = mock_sheet
        self.mock_repo.update.side_effect = lambda sid, fields: MagicMock(id=sid, **fields)

        dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
        self.mock_preprocessor.load.return_value = dummy_img
        
        mock_prep_res = MagicMock()
        mock_prep_res.processed = dummy_img
        self.mock_preprocessor.preprocess.return_value = mock_prep_res

        mock_hwr_res = HWRResult(
            text="Q1. Explain OS.",
            confidence=0.90,
            lines=[
                HWRLine(text="Q1. Explain OS.", confidence=0.90, boundingBox=[[0,0], [10,0], [10,10], [0,10]])
            ],
            provider="mock",
            execution_time=0.01
        )
        self.mock_hwr.recognize_handwriting.return_value = mock_hwr_res

        mock_seg_ans = SegmentedAnswer(
            question_number="1",
            normalized_question_number="Q1",
            original_header="Q1. Explain OS.",
            answer_text="Explain OS answers...",
            confidence=0.90,
            start_line=1,
            end_line=1,
            metadata=AnswerMetadata(page_start=1, page_end=1, line_count=1),
            confidence_level="HIGH",
            source_pages=[1],
            status="READY_FOR_EVALUATION"
        )
        mock_seg_res = SegmentationResult(
            answers=[mock_seg_ans],
            duplicate_questions=[],
            missing_questions=[],
            unknown_sections=[],
            warnings=[],
            execution_time=0.02
        )
        self.mock_segmentation.segment_answers.return_value = mock_seg_res

        # Write original source so storage.download doesn't fail
        self.storage.upload(f"student-1/{sheet_id}/original/source.pdf", self.valid_pdf_bytes)

        await self.processing_service.process_sheet_task(sheet_id)

        # Verify that repo updates page content and sets status to COMPLETED
        update_calls = self.mock_repo.update.call_args_list
        self.assertTrue(any(
            call[0][1].get("processing_status") == AnswerSheetStatus.COMPLETED 
            for call in update_calls
        ))
        
        # Verify page-level records populated
        self.assertTrue(any(
            call[0][1].get("pages") is not None and len(call[0][1]["pages"]) > 0 
            for call in update_calls
        ))

    async def test_reprocess_sheet_success(self):
        sheet_id = "test-sheet-id-reprocess"
        mock_sheet = MagicMock(
            id=sheet_id,
            student_id="student-1",
            exam_id="exam-2",
            original_filename="sheet.pdf",
            original_format="PDF",
            processing_status=AnswerSheetStatus.FAILED,
            processing_progress=35,
            current_step="Failed",
            processing_attempt=1,
            processing_history=[]
        )
        self.mock_repo.get.return_value = mock_sheet
        self.mock_repo.update.return_value = mock_sheet

        await self.processing_service.reprocess_sheet(sheet_id)

        # Reprocess resets state back to QUEUED
        self.mock_repo.update.assert_called_with(
            sheet_id,
            {
                "processing_status": AnswerSheetStatus.QUEUED,
                "processing_progress": 0,
                "current_step": "Queued for reprocessing",
                "queued_at": unittest.mock.ANY,
                "error_message": None,
                "error_details": None,
                "updated_at": unittest.mock.ANY
            }
        )

    def test_run_local_tasks(self):
        import asyncio
        asyncio.run(self.test_enqueue_for_processing_success())
        asyncio.run(self.test_process_sheet_task_success())
        asyncio.run(self.test_reprocess_sheet_success())


if __name__ == "__main__":
    unittest.main()
