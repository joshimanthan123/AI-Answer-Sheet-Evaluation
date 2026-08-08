import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_evaluation_service
from app.models.evaluation_models import EvaluationResult, EvaluationSummary
from app.core.exceptions import (
    EvaluationAnswerKeyNotFound,
    EvaluationQuestionNotFound,
    MarksOutOfRange,
    EvaluationFailed,
)

class TestEvaluationRoutes(unittest.TestCase):
    """
    Integration tests using FastAPI TestClient to verify evaluation endpoint envelopes and error codes.
    """

    def setUp(self) -> None:
        self.client = TestClient(app)
        self.mock_service = AsyncMock()
        # Override dependency
        app.dependency_overrides[get_evaluation_service] = lambda: self.mock_service
        self.key_id = str(uuid4())

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_evaluate_answer_success(self) -> None:
        eval_result = EvaluationResult(
            answer_key_id=self.key_id,
            question_number="Q1",
            student_answer="OSI has seven layers.",
            marks_awarded=4.0,
            maximum_marks=5.0,
            feedback="Well written",
            strengths=["clear"],
            missing_points=[],
            matched_keywords=["OSI", "layers"],
            missing_keywords=[],
            confidence=0.92,
            evaluated_by="llm",
            provider="mock",
            model="mock-model",
            created_at=datetime.now(timezone.utc)
        )
        self.mock_service.evaluate.return_value = eval_result

        payload = {
            "answer_key_id": self.key_id,
            "question_number": "Q1",
            "student_answer": "OSI has seven layers."
        }

        response = self.client.post("/api/v1/evaluations", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["marks_awarded"], 4.0)
        self.assertEqual(data["data"]["feedback"], "Well written")

    def test_evaluate_answer_empty_field(self) -> None:
        # Pydantic validation error (question_number empty)
        payload = {
            "answer_key_id": self.key_id,
            "question_number": "   ",
            "student_answer": "OSI layers"
        }
        response = self.client.post("/api/v1/evaluations", json=payload)
        self.assertEqual(response.status_code, 400) # Fastapi validation handler returns 400

    def test_evaluate_answer_key_not_found(self) -> None:
        self.mock_service.evaluate.side_effect = EvaluationAnswerKeyNotFound("Answer key not found.")
        payload = {
            "answer_key_id": str(uuid4()),
            "question_number": "Q1",
            "student_answer": "Any student response"
        }
        response = self.client.post("/api/v1/evaluations", json=payload)
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "EVALUATION_ANSWER_KEY_NOT_FOUND")

    def test_evaluate_answer_question_not_found(self) -> None:
        self.mock_service.evaluate.side_effect = EvaluationQuestionNotFound("Question not found.")
        payload = {
            "answer_key_id": self.key_id,
            "question_number": "Q9",
            "student_answer": "Any student response"
        }
        response = self.client.post("/api/v1/evaluations", json=payload)
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "EVALUATION_QUESTION_NOT_FOUND")

    def test_evaluate_answer_provider_failure(self) -> None:
        self.mock_service.evaluate.side_effect = EvaluationFailed("LLM connection timed out.")
        payload = {
            "answer_key_id": self.key_id,
            "question_number": "Q1",
            "student_answer": "Any student response"
        }
        response = self.client.post("/api/v1/evaluations", json=payload)
        self.assertEqual(response.status_code, 500)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "EVALUATION_FAILED")

    def test_evaluate_summary_success(self) -> None:
        eval_summary = EvaluationSummary(
            total_marks_awarded=8.0,
            total_maximum_marks=10.0,
            percentage=80.0,
            question_count=2
        )
        self.mock_service.calculate_summary = MagicMock(return_value=eval_summary)

        payload = {
            "results": [
                {"marks_awarded": 5.0, "maximum_marks": 5.0},
                {"marks_awarded": 3.0, "maximum_marks": 5.0}
            ]
        }

        response = self.client.post("/api/v1/evaluations/summary", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["percentage"], 80.0)
        self.assertEqual(data["data"]["question_count"], 2)
