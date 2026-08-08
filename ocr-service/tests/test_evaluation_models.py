import unittest
from datetime import datetime, timezone
from pydantic import ValidationError
from app.models.evaluation_models import EvaluationRequest, EvaluationResult, EvaluationSummary

class TestEvaluationModels(unittest.TestCase):
    """
    Unit tests ensuring validity and constraints verification on evaluation schemas.
    """

    def test_evaluation_request_valid(self) -> None:
        req = EvaluationRequest(
            answer_key_id="550e8400-e29b-41d4-a716-446655440000",
            question_number="Q1",
            student_answer="  The OSI model has seven layers.  "
        )
        self.assertEqual(req.answer_key_id, "550e8400-e29b-41d4-a716-446655440000")
        self.assertEqual(req.question_number, "Q1")
        # Ensure student answer gets stripped of leading/trailing whitespace
        self.assertEqual(req.student_answer, "The OSI model has seven layers.")

    def test_evaluation_request_empty_key_id(self) -> None:
        with self.assertRaises(ValidationError):
            EvaluationRequest(
                answer_key_id="   ",
                question_number="Q1",
                student_answer="Database logic"
            )

    def test_evaluation_request_empty_question_num(self) -> None:
        with self.assertRaises(ValidationError):
            EvaluationRequest(
                answer_key_id="550e8400-e29b-41d4-a716-446655440000",
                question_number="",
                student_answer="Database logic"
            )

    def test_evaluation_result_valid(self) -> None:
        res = EvaluationResult(
            answer_key_id="550e8400-e29b-41d4-a716-446655440000",
            question_number="Q1",
            student_answer="The OSI model has seven layers.",
            marks_awarded=3.5,
            maximum_marks=5.0,
            feedback="Good structure, missed security layer details.",
            strengths=["Clear list", "Correct definition"],
            missing_points=["Layer session control"],
            matched_keywords=["OSI", "seven", "layers"],
            missing_keywords=["session", "presentation"],
            confidence=0.95,
            evaluated_by="llm",
            provider="mock",
            model="mock-model",
            created_at=datetime.utcnow()
        )
        self.assertEqual(res.marks_awarded, 3.5)
        self.assertEqual(res.confidence, 0.95)

    def test_evaluation_result_negative_marks(self) -> None:
        with self.assertRaises(ValidationError):
            EvaluationResult(
                answer_key_id="550e8400-e29b-41d4-a716-446655440000",
                question_number="Q1",
                student_answer="Model check",
                marks_awarded=-1.0,
                maximum_marks=5.0,
                feedback="Incorrect",
                strengths=[],
                missing_points=[],
                matched_keywords=[],
                missing_keywords=[],
                confidence=0.5,
                evaluated_by="llm",
                provider="mock",
                model="mock-model",
                created_at=datetime.utcnow()
            )

    def test_evaluation_result_confidence_invalid(self) -> None:
        # Confidence below 0
        with self.assertRaises(ValidationError):
            EvaluationResult(
                answer_key_id="550e8400-e29b-41d4-a716-446655440000",
                question_number="Q1",
                student_answer="Model check",
                marks_awarded=2.0,
                maximum_marks=5.0,
                feedback="Incorrect",
                strengths=[],
                missing_points=[],
                matched_keywords=[],
                missing_keywords=[],
                confidence=-0.1,
                evaluated_by="llm",
                provider="mock",
                model="mock-model",
                created_at=datetime.utcnow()
            )

        # Confidence above 1.0
        with self.assertRaises(ValidationError):
            EvaluationResult(
                answer_key_id="550e8400-e29b-41d4-a716-446655440000",
                question_number="Q1",
                student_answer="Model check",
                marks_awarded=2.0,
                maximum_marks=5.0,
                feedback="Incorrect",
                strengths=[],
                missing_points=[],
                matched_keywords=[],
                missing_keywords=[],
                confidence=1.1,
                evaluated_by="llm",
                provider="mock",
                model="mock-model",
                created_at=datetime.utcnow()
            )

    def test_evaluation_summary(self) -> None:
        summary = EvaluationSummary(
            total_marks_awarded=15.5,
            total_maximum_marks=20.0,
            percentage=77.5,
            question_count=4
        )
        self.assertEqual(summary.percentage, 77.5)
        self.assertEqual(summary.question_count, 4)
