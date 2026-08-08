import os
import sys
import unittest
from uuid import uuid4, UUID
from datetime import datetime
from pydantic import ValidationError

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.exceptions import (
    AnswerKeyNotFound,
    DuplicateQuestionNumber,
    DuplicateKeyword,
    InvalidMarks,
)
from app.models.answer_key_models import (
    CreateAnswerKeyRequest,
    UpdateAnswerKeyRequest,
    AnswerKeyQuestion,
    KeywordModel,
)
from app.repositories.answer_key_repository import MemoryAnswerKeyRepository
from app.services.answer_key_service import AnswerKeyService
from app.dependencies import get_answer_key_repository


class TestAnswerKeyService(unittest.TestCase):
    """
    Unit test suite verifying the Answer Key Service business logic.
    """

    def setUp(self):
        self.repo = MemoryAnswerKeyRepository()
        self.service = AnswerKeyService(self.repo)

        # Baseline valid request properties
        self.valid_question = AnswerKeyQuestion(
            question_number="q1",
            question_text="Describe the architecture of FastAPI.",
            model_answer="FastAPI utilizes Starlette for web routing and Pydantic for validation.",
            maximum_marks=5.0,
            difficulty="medium",
            notes="Requires mentioning Starlette and Pydantic.",
            source="manual",
            expected_time=10,
            minimum_keywords_required=2,
            keywords=[
                KeywordModel(keyword="Starlette", weight=1.5),
                KeywordModel(keyword="Pydantic", weight=1.0)
            ]
        )

        self.valid_request = CreateAnswerKeyRequest(
            subject="Web Services",
            subject_code="WS101",
            exam_name="End Semester",
            exam_type="Theory",
            semester="5",
            academic_year="2026",
            faculty_name="Prof. Johnson",
            status="published",
            version=1,
            questions=[self.valid_question]
        )

    def test_create_answer_key_success(self):
        """Verify successful creation of an answer key."""
        res = self.repo.count()
        # Should be initially 0
        self.assertEqual(self.repo._storage, {})
        
        created = asyncio_run(self.service.create_answer_key(self.valid_request))
        
        self.assertIsNotNone(created.id)
        self.assertEqual(created.subject, "Web Services")
        self.assertEqual(created.subject_code, "WS101")
        self.assertEqual(len(created.questions), 1)
        self.assertEqual(created.questions[0].question_number, "Q1")  # Normalized upper!
        self.assertEqual(created.status, "published")
        self.assertIsInstance(created.created_at, datetime)
        self.assertIsInstance(created.updated_at, datetime)
        self.assertFalse(created.is_deleted)

    def test_validation_empty_spaces(self):
        """Pydantic validations fail for empty or whitespace-only inputs."""
        with self.assertRaises(ValidationError):
            KeywordModel(keyword="   ", weight=1.0)

        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(
                question_number="Q1",
                question_text="   ",
                model_answer="Valid Answer",
                maximum_marks=5.0
            )

        with self.assertRaises(ValidationError):
            CreateAnswerKeyRequest(
                subject="   ",
                exam_name="Mid Sem",
                faculty_name="Prof",
                questions=[self.valid_question]
            )

    def test_validation_maximum_marks_and_keywords(self):
        """Pydantic validation enforcing limits (max length, max keywords, max marks, expected time)."""
        # Marks must be > 0 and <= MAX_QUESTION_MARKS (default 100.0)
        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "maximum_marks": 0.0})

        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "maximum_marks": 105.0})

        # Expected time validated > 0
        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "expected_time": -5})

        # Min keywords validated >= 0
        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "minimum_keywords_required": -1})

        # Exceeding MAX_MODEL_ANSWER_LENGTH (default 10000)
        long_answer = "x" * 10001
        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "model_answer": long_answer})

        # Exceeding MAX_KEYWORDS (default 50)
        many_keywords = [KeywordModel(keyword=f"kw{i}") for i in range(55)]
        with self.assertRaises(ValidationError):
            AnswerKeyQuestion(**{**self.valid_question.model_dump(), "keywords": many_keywords})


    def test_duplicate_question_number_exception(self):
        """Verify DuplicateQuestionNumber with case and strip normalization."""
        q1 = self.valid_question.model_copy(update={"question_number": "Q1"})
        q2 = self.valid_question.model_copy(update={"question_number": " q1 "}) # duplicates normalized Q1
        
        req = self.valid_request.model_copy(update={"questions": [q1, q2]})
        with self.assertRaises(DuplicateQuestionNumber):
            asyncio_run(self.service.create_answer_key(req))

    def test_duplicate_keywords_exception(self):
        """Verify DuplicateKeyword with case and strip normalization."""
        q = self.valid_question.model_copy(update={
            "keywords": [
                KeywordModel(keyword="Database"),
                KeywordModel(keyword=" database ") # Duplicate normalized lowercase!
            ]
        })
        req = self.valid_request.model_copy(update={"questions": [q]})
        with self.assertRaises(DuplicateKeyword):
            asyncio_run(self.service.create_answer_key(req))

    def test_invalid_marks_service_validation(self):
        """Verify marks validation raises correct Service exception."""
        # Using Bypass of validation since pydantic will check during constructor, 
        # but let's test that if we pass negative maximum marks to service, it raises InvalidMarks
        q = self.valid_question.model_copy()
        # Direct attribute bypass for testing
        q.__dict__["maximum_marks"] = -1.0
        req = self.valid_request.model_copy(update={"questions": [q]})
        with self.assertRaises(InvalidMarks):
            asyncio_run(self.service.create_answer_key(req))

    def test_get_answer_key_success_and_not_found(self):
        """Verify successful get and raising AnswerKeyNotFound."""
        created = asyncio_run(self.service.create_answer_key(self.valid_request))
        fetched = asyncio_run(self.service.get_answer_key(created.id))
        self.assertEqual(fetched.id, created.id)

        unknown_id = uuid4()
        with self.assertRaises(AnswerKeyNotFound):
            asyncio_run(self.service.get_answer_key(unknown_id))

    def test_update_answer_key_success(self):
        """Verify updating selected fields, timestamps and validations during update."""
        created = asyncio_run(self.service.create_answer_key(self.valid_request))
        
        # Partially update some fields
        update_req = UpdateAnswerKeyRequest(
            subject="Advanced Web Services",
            exam_type="Practical",
            version=3
        )
        updated = asyncio_run(self.service.update_answer_key(created.id, update_req))
        self.assertEqual(updated.subject, "Advanced Web Services")
        self.assertEqual(updated.exam_type, "Practical")
        self.assertEqual(updated.version, 3)
        self.assertEqual(updated.faculty_name, "Prof. Johnson") # unchanged
        self.assertGreater(updated.updated_at, created.created_at)

        # Non-existent update
        with self.assertRaises(AnswerKeyNotFound):
            asyncio_run(self.service.update_answer_key(uuid4(), update_req))

        # Check duplicate validations run on updated questions
        invalid_q_update = UpdateAnswerKeyRequest(
            questions=[
                self.valid_question.model_copy(update={"question_number": "Q2"}),
                self.valid_question.model_copy(update={"question_number": "q2"})
            ]
        )
        with self.assertRaises(DuplicateQuestionNumber):
            asyncio_run(self.service.update_answer_key(created.id, invalid_q_update))

    def test_delete_answer_key_soft_delete(self):
        """Verify soft-delete hides keys from queries but retains record with is_deleted flag."""
        created = asyncio_run(self.service.create_answer_key(self.valid_request))
        self.assertEqual(asyncio_run(self.service.get_count()), 1)

        # Perform soft-delete
        asyncio_run(self.service.delete_answer_key(created.id))

        # Count goes to 0
        self.assertEqual(asyncio_run(self.service.get_count()), 0)

        # Fetch throws NotFound
        with self.assertRaises(AnswerKeyNotFound):
            asyncio_run(self.service.get_answer_key(created.id))

        # Exists returns False
        self.assertFalse(asyncio_run(self.repo.exists(created.id)))

        # List returns empty
        active_list = asyncio_run(self.service.list_answer_keys())
        self.assertEqual(len(active_list), 0)

        # Deleting non-existent
        with self.assertRaises(AnswerKeyNotFound):
            asyncio_run(self.service.delete_answer_key(uuid4()))


class TestAnswerKeyRouter(unittest.TestCase):
    """
    Integration test suite verifying API routes.
    """

    def setUp(self):
        self.client = TestClient(app)
        
        # Reset current in-memory DB singleton state
        self.repo = get_answer_key_repository()
        if hasattr(self.repo, "_storage"):
            self.repo._storage.clear()

        self.payload = {
            "subject": "Operating System",
            "subject_code": "CE401",
            "exam_name": "Mid Semester",
            "exam_type": "Written",
            "semester": "4",
            "academic_year": "2026",
            "faculty_name": "Dr. ABC",
            "status": "draft",
            "version": 1,
            "questions": [
                {
                    "question_number": "Q1",
                    "question_text": "Explain OSI Model",
                    "model_answer": "OSI model has 7 layers.",
                    "maximum_marks": 5.0,
                    "difficulty": "easy",
                    "source": "manual",
                    "expected_time": 8,
                    "minimum_keywords_required": 1,
                    "keywords": [
                        {"keyword": "Layer", "weight": 1.0}
                    ]
                }
            ]
        }

    def test_router_create_success(self):
        """Verify POST /api/v1/answer-keys returns 201 and ApiResponse wrapper."""
        res = self.client.post("/api/v1/answer-keys", json=self.payload)
        self.assertEqual(res.status_code, 201)
        
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["message"], "Answer key created successfully.")
        self.assertIn("id", body["data"])
        self.assertEqual(body["data"]["subject"], "Operating System")

    def test_router_create_validation_failure(self):
        """Verify POST returns 400 when schemas validate invalid payloads (e.g. empty subject)."""
        bad_payload = self.payload.copy()
        bad_payload["subject"] = "   " # Whitespace only
        
        res = self.client.post("/api/v1/answer-keys", json=bad_payload)
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertIn("Validation failed", body["message"])

    def test_router_duplicate_question_failure(self):
        """Verify POST returns custom exception JSONResponse (400) for duplicate question numbers."""
        bad_payload = self.payload.copy()
        bad_payload["questions"] = [
            self.payload["questions"][0],
            self.payload["questions"][0] # duplicate Q1
        ]
        res = self.client.post("/api/v1/answer-keys", json=bad_payload)
        self.assertEqual(res.status_code, 400)
        
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["data"]["error_code"], "DUPLICATE_QUESTION_NUMBER")

    def test_router_get_success_and_missing(self):
        """Verify GET /api/v1/answer-keys/{id} succeeds and gives 404 for unknown IDs."""
        create_res = self.client.post("/api/v1/answer-keys", json=self.payload)
        key_id = create_res.json()["data"]["id"]

        get_res = self.client.get(f"/api/v1/answer-keys/{key_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertTrue(get_res.json()["success"])
        self.assertEqual(get_res.json()["data"]["id"], key_id)

        random_id = str(uuid4())
        get_fail = self.client.get(f"/api/v1/answer-keys/{random_id}")
        self.assertEqual(get_fail.status_code, 404)
        self.assertFalse(get_fail.json()["success"])
        self.assertEqual(get_fail.json()["data"]["error_code"], "ANSWER_KEY_NOT_FOUND")

    def test_router_update_success(self):
        """Verify PUT /api/v1/answer-keys/{id} modifies data."""
        create_res = self.client.post("/api/v1/answer-keys", json=self.payload)
        key_id = create_res.json()["data"]["id"]

        update_payload = {"subject": "Distributed Systems", "status": "published"}
        put_res = self.client.put(f"/api/v1/answer-keys/{key_id}", json=update_payload)
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["data"]["subject"], "Distributed Systems")
        self.assertEqual(put_res.json()["data"]["status"], "published")

    def test_router_delete_success(self):
        """Verify DELETE /api/v1/answer-keys/{id} soft-deletes returning 204 No Content."""
        create_res = self.client.post("/api/v1/answer-keys", json=self.payload)
        key_id = create_res.json()["data"]["id"]

        del_res = self.client.delete(f"/api/v1/answer-keys/{key_id}")
        self.assertEqual(del_res.status_code, 204)
        self.assertEqual(del_res.text, "")

        # Verify it's no longer accessible
        get_res = self.client.get(f"/api/v1/answer-keys/{key_id}")
        self.assertEqual(get_res.status_code, 404)


def asyncio_run(coro):
    """Simple helper to run coroutines synchronously in unittest env."""
    import asyncio
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


if __name__ == "__main__":
    unittest.main()
