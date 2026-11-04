import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_answer_sheet_service
from app.models.answer_sheet_models import AnswerSheetStatus, AnswerSheetResponse, AnswerSheetPage, DigitalAnswer
from app.core.exceptions import (
    AnswerSheetNotFound,
    AnswerSheetAccessDenied,
    UnsupportedAnswerSheetFormat,
)


class TestAnswerSheetRoutes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
        # self.mock_service must handle synchronous calls on storage and repository without triggering async coroutines
        self.mock_service = MagicMock()
        self.mock_service.process_answer_sheet = AsyncMock()
        self.mock_service.repository = AsyncMock()
        self.mock_service.storage = MagicMock() # Storage methods are synchronous!
        
        # Bridge service methods to mock repository/storage
        async def mock_get_answer_sheet(sheet_id):
            res = await self.mock_service.repository.get(sheet_id)
            if res is None:
                raise AnswerSheetNotFound(f"Answer sheet '{sheet_id}' not found.")
            return res
        self.mock_service.get_answer_sheet = mock_get_answer_sheet

        async def mock_list_answer_sheets(student_id=None, exam_id=None):
            res = await self.mock_service.repository.list()
            # Handle if repository returning magic mocks/lists
            if not isinstance(res, list):
                return res
            if student_id:
                res = [r for r in res if r.student_id == student_id]
            if exam_id:
                res = [r for r in res if r.exam_id == exam_id]
            return res
        self.mock_service.list_answer_sheets = mock_list_answer_sheets

        async def mock_delete_answer_sheet(sheet_id):
            return await self.mock_service.repository.delete(sheet_id)
        self.mock_service.delete_answer_sheet = mock_delete_answer_sheet

        def mock_get_page_file(sheet, page_number, type_str):
            return self.mock_service.storage.download("mock-path")
        self.mock_service.get_page_file = mock_get_page_file
        
        # Override service dependency
        app.dependency_overrides[get_answer_sheet_service] = lambda: self.mock_service
        self.sheet_uuid = uuid4()
        
        # Setup standard mock sheet response
        self.mock_sheet = AnswerSheetResponse(
            id=self.sheet_uuid,
            student_id="student-1",
            exam_id="exam-100",
            original_filename="submission.pdf",
            original_format="pdf",
            file_size=500 * 1024,
            page_count=1,
            processing_status=AnswerSheetStatus.EVALUATION_PENDING,
            pages=[
                AnswerSheetPage(
                    page_number=1,
                    original_file_reference="student-1/uuid/original/page-001.png",
                    processed_file_reference="student-1/uuid/processed/page-001.png",
                    width=1000,
                    height=1400,
                    processing_status="completed"
                )
            ],
            digital_answers=[
                DigitalAnswer(
                    question_number="Q1",
                    text="Operating Systems handle concurrent processes.",
                    page_number=1,
                    confidence=0.88
                )
            ],
            uploaded_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_student_upload_success(self):
        self.mock_service.process_answer_sheet.return_value = self.mock_sheet
        
        payload = {"exam_id": "exam-100"}
        files = {"file": ("submission.pdf", b"%PDF-1.4...", "application/pdf")}
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        
        response = self.client.post(
            "/api/v1/student/answer-sheets",
            data=payload,
            files=files,
            headers=headers
        )
        
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["original_filename"], "submission.pdf")

    def test_student_upload_invalid_role(self):
        payload = {"exam_id": "exam-100"}
        files = {"file": ("submission.pdf", b"%PDF-1.4...", "application/pdf")}
        headers = {"X-User-Id": "faculty-1", "X-User-Role": "faculty"}
        
        response = self.client.post(
            "/api/v1/student/answer-sheets",
            data=payload,
            files=files,
            headers=headers
        )
        
        self.assertEqual(response.status_code, 403)
        self.assertIn("Student role context required", response.json()["detail"])

    def test_student_upload_missing_auth_headers(self):
        payload = {"exam_id": "exam-100"}
        files = {"file": ("submission.pdf", b"%PDF-1.4...", "application/pdf")}
        
        response = self.client.post(
            "/api/v1/student/answer-sheets",
            data=payload,
            files=files
        )
        self.assertEqual(response.status_code, 401)

    def test_student_list_submissions(self):
        self.mock_service.repository.list.return_value = [self.mock_sheet]
        
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get("/api/v1/student/answer-sheets", headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 1)
        self.assertEqual(data["data"][0]["student_id"], "student-1")

    def test_student_get_detail_success(self):
        self.mock_service.repository.get.return_value = self.mock_sheet
        
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get(
            f"/api/v1/student/answer-sheets/{self.sheet_uuid}",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_student_get_detail_unauthorized_access(self):
        self.mock_service.repository.get.return_value = self.mock_sheet
        
        headers = {"X-User-Id": "student-2", "X-User-Role": "student"}
        response = self.client.get(
            f"/api/v1/student/answer-sheets/{self.sheet_uuid}",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["data"]["error_code"], "ANSWER_SHEET_ACCESS_DENIED")

    def test_student_get_detail_not_found(self):
        self.mock_service.repository.get.return_value = None
        
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get(
            f"/api/v1/student/answer-sheets/{uuid4()}",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["data"]["error_code"], "ANSWER_SHEET_NOT_FOUND")

    def test_student_get_original_file(self):
        self.mock_service.repository.get.return_value = self.mock_sheet
        self.mock_service.storage.download.return_value = b"raw-pdf-data"
        
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get(
            f"/api/v1/student/answer-sheets/{self.sheet_uuid}/original",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"raw-pdf-data")
        self.assertEqual(response.headers["content-type"], "application/pdf")

    def test_student_get_digital_answers(self):
        self.mock_service.repository.get.return_value = self.mock_sheet
        
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get(
            f"/api/v1/student/answer-sheets/{self.sheet_uuid}/digital",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 1)
        self.assertEqual(data["data"][0]["question_number"], "Q1")

    # =========================================================================
    # Faculty Route Tests
    # =========================================================================
    def test_faculty_list_success(self):
        self.mock_service.repository.list.return_value = [self.mock_sheet]
        
        headers = {"X-User-Id": "teacher-1", "X-User-Role": "faculty"}
        response = self.client.get("/api/v1/faculty/answer-sheets", headers=headers)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(len(response.json()["data"]), 1)

    def test_faculty_get_detail_any_sheet(self):
        self.mock_service.repository.get.return_value = self.mock_sheet
        
        headers = {"X-User-Id": "teacher-1", "X-User-Role": "faculty"}
        response = self.client.get(
            f"/api/v1/faculty/answer-sheets/{self.sheet_uuid}",
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["student_id"], "student-1")

    def test_faculty_unauthorized_role(self):
        headers = {"X-User-Id": "student-1", "X-User-Role": "student"}
        response = self.client.get("/api/v1/faculty/answer-sheets", headers=headers)
        
        self.assertEqual(response.status_code, 403)
