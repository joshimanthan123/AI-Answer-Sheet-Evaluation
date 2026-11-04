import unittest
from datetime import datetime
from uuid import uuid4
from app.models.answer_sheet_models import AnswerSheetResponse, AnswerSheetPage, DigitalAnswer, AnswerSheetStatus

class TestAnswerSheetModels(unittest.TestCase):
    def test_page_model(self):
        page = AnswerSheetPage(
            page_number=1,
            original_file_reference="ref-orig",
            processed_file_reference="ref-proc",
            width=600,
            height=800,
            processing_status="PROCESSED"
        )
        self.assertEqual(page.page_number, 1)
        self.assertEqual(page.width, 600)

    def test_digital_answer_model(self):
        ans = DigitalAnswer(
            question_number="Q1",
            text="Node based structure",
            page_number=1,
            confidence=0.92
        )
        self.assertEqual(ans.question_number, "Q1")
        self.assertEqual(ans.confidence, 0.92)

    def test_sheet_response_model(self):
        uuid_val = uuid4()
        now = datetime.now()
        sheet = AnswerSheetResponse(
            id=uuid_val,
            student_id="stud-1",
            exam_id="exam-22",
            original_filename="source.pdf",
            original_format="PDF",
            file_size=2048,
            page_count=2,
            processing_status=AnswerSheetStatus.COMPLETED,
            pages=[],
            digital_answers=[],
            uploaded_at=now,
            updated_at=now
        )
        self.assertEqual(sheet.id, uuid_val)
        self.assertEqual(sheet.processing_status, AnswerSheetStatus.COMPLETED)
