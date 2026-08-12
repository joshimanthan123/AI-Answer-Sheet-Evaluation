import unittest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import fitz
import numpy as np

from app.core.exceptions import (
    UnsupportedAnswerSheetFormat,
    AnswerSheetTooLarge,
    InvalidAnswerSheetFile,
    AnswerSheetProcessingError,
)
from app.models.answer_sheet_models import AnswerSheetStatus
from app.services.local_storage import LocalStorage
from app.services.answer_sheet_service import AnswerSheetService


class TestAnswerSheetService(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage = LocalStorage(root_dir=Path(self.test_dir))
        self.mock_repo = AsyncMock()
        self.mock_preprocessor = MagicMock()
        self.mock_hwr = MagicMock()
        self.mock_segmentation = MagicMock()
        
        # Patch settings ANSWER_SHEET_STORAGE_DIR to point to local tmp
        self.patcher = patch("app.services.answer_sheet_service.settings")
        self.mock_settings = self.patcher.start()
        self.mock_settings.ANSWER_SHEET_STORAGE_DIR = Path(self.test_dir)
        self.mock_settings.ANSWER_SHEET_MAX_UPLOAD_SIZE_MB = 20
        self.mock_settings.ANSWER_SHEET_ALLOWED_EXTENSIONS = [
            ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"
        ]

        self.service = AnswerSheetService(
            storage=self.storage,
            repository=self.mock_repo,
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

    def test_validate_file_extensions(self):
        # Valid files
        ext = self.service.validate_file("sheet.pdf", self.valid_pdf_bytes)
        self.assertEqual(ext, ".pdf")
        
        ext2 = self.service.validate_file("image.JPG", self.valid_jpg_bytes)
        self.assertEqual(ext2, ".jpg")

        # Invalid extension
        with self.assertRaises(UnsupportedAnswerSheetFormat):
            self.service.validate_file("doc.txt", b"plain text")

        # Invalid signatures
        with self.assertRaises(InvalidAnswerSheetFile):
            self.service.validate_file("file.pdf", b"not-a-pdf-header-content")
            
        with self.assertRaises(InvalidAnswerSheetFile):
            self.service.validate_file("image.jpg", b"not-a-jpg-header-content")

        # Large file
        oversized_bytes = b"\x25PDF" + b"\x00" * (21 * 1024 * 1024)
        with self.assertRaises(AnswerSheetTooLarge):
            self.service.validate_file("huge.pdf", oversized_bytes)

    @patch("app.services.answer_sheet_service.datetime")
    async def test_process_answer_sheet_pdf_success(self, mock_datetime):
        self.mock_repo.create.return_value = None
        self.mock_repo.update.side_effect = lambda sheet_id, fields: MagicMock(
            id=sheet_id,
            student_id="student-1",
            exam_id="exam-2",
            original_filename="sheet.pdf",
            original_format="pdf",
            **fields
        )

        dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
        self.mock_preprocessor.load.return_value = dummy_img
        
        mock_prep_res = MagicMock()
        mock_prep_res.processed = dummy_img
        self.mock_preprocessor.preprocess.return_value = mock_prep_res

        magic_hwr_res = MagicMock()
        self.mock_hwr.recognize_handwriting.return_value = magic_hwr_res

        mock_seg_ans = MagicMock()
        mock_seg_ans.normalized_question_number = "Q1"
        mock_seg_ans.answer_text = "Recognized answer test"
        mock_seg_ans.metadata.page_start = 1
        mock_seg_ans.confidence = 0.90
        
        mock_seg_res = MagicMock()
        mock_seg_res.answers = [mock_seg_ans]
        self.mock_segmentation.segment_answers.return_value = mock_seg_res

        res = await self.service.process_answer_sheet(
            student_id="student-1",
            exam_id="exam-2",
            filename="sheet.pdf",
            content=self.valid_pdf_bytes,
        )

        self.assertIsNotNone(res)
        self.assertTrue(self.storage.exists(f"student-1/{res.id}/original/source.pdf"))
        self.mock_repo.create.assert_called_once()
        self.mock_preprocessor.preprocess.assert_called_once()
        self.mock_hwr.recognize_handwriting.assert_called_once()
        self.mock_segmentation.segment_answers.assert_called_once()

    async def test_process_answer_sheet_image_success(self):
        self.mock_repo.create.return_value = None
        self.mock_repo.update.side_effect = lambda sheet_id, fields: MagicMock(
            id=sheet_id,
            student_id="student-1",
            exam_id="exam-2",
            original_filename="image.jpg",
            original_format="JPG",
            **fields
        )

        dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
        self.mock_preprocessor.load.return_value = dummy_img
        
        mock_prep_res = MagicMock()
        mock_prep_res.processed = dummy_img
        self.mock_preprocessor.preprocess.return_value = mock_prep_res

        self.mock_hwr.recognize_handwriting.return_value = MagicMock()
        
        mock_seg_ans = MagicMock()
        mock_seg_ans.normalized_question_number = "Q1"
        mock_seg_ans.answer_text = "Recognized answer test image"
        mock_seg_ans.metadata.page_start = 1
        mock_seg_ans.confidence = 0.90
        
        mock_seg_res = MagicMock()
        mock_seg_res.answers = [mock_seg_ans]
        self.mock_segmentation.segment_answers.return_value = mock_seg_res

        res = await self.service.process_answer_sheet(
            student_id="student-1",
            exam_id="exam-2",
            filename="image.jpg",
            content=self.valid_jpg_bytes,
        )

        self.assertIsNotNone(res)
        self.assertTrue(self.storage.exists(f"student-1/{res.id}/original/source.jpg"))
        self.assertTrue(self.storage.exists(f"student-1/{res.id}/original/page-001.png"))
        self.assertTrue(self.storage.exists(f"student-1/{res.id}/processed/page-001.png"))

    async def test_process_answer_sheet_failure_status(self):
        self.mock_repo.create.return_value = None
        
        # Make load crash during conversion to raise processing error
        self.mock_preprocessor.load.side_effect = Exception("OpenCV mock load error")
        
        with self.assertRaises(AnswerSheetProcessingError):
            await self.service.process_answer_sheet(
                student_id="student-1",
                exam_id="exam-2",
                filename="sheet.pdf",
                content=self.valid_pdf_bytes,
            )

        self.mock_repo.update.assert_any_call(
            unittest.mock.ANY,
            {"processing_status": AnswerSheetStatus.FAILED, "updated_at": unittest.mock.ANY}
        )

    def test_run_service_pipeline(self):
        import asyncio
        asyncio.run(self.test_process_answer_sheet_pdf_success())
        asyncio.run(self.test_process_answer_sheet_image_success())
        asyncio.run(self.test_process_answer_sheet_failure_status())
