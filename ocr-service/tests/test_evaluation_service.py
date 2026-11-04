import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.models.evaluation_models import EvaluationRequest, EvaluationResult, EvaluationSummary
from app.models.answer_key_models import AnswerKeyResponse, AnswerKeyQuestion, KeywordModel
from app.models.llm_models import LLMResponse
from app.models.evaluation_llm_models import LLMEvaluationResponse
from app.services.evaluation_service import EvaluationService
from app.core.exceptions import (
    EvaluationAnswerKeyNotFound,
    EvaluationQuestionNotFound,
    MarksOutOfRange,
    EvaluationFailed,
    EvaluationResponseParseError,
    AnswerKeyNotFound,
)

class TestEvaluationService(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests exercising the AI evaluation pipeline and business rules mapping.
    """

    def setUp(self) -> None:
        self.mock_answer_key_service = MagicMock()
        self.mock_prompt_service = MagicMock()
        self.mock_llm_provider = AsyncMock()
        self.mock_response_parser = MagicMock()
        self.mock_keyword_service = MagicMock()

        # Set up a sample AnswerKey response
        self.key_id = uuid4()
        self.question = AnswerKeyQuestion(
            question_number="Q1",
            question_text="Describe OSI model layers",
            model_answer="It contains seven layers.",
            keywords=[
                KeywordModel(keyword="OSI", weight=1.0),
                KeywordModel(keyword="layers", weight=1.0)
            ],
            maximum_marks=5.0
        )
        self.answer_key = AnswerKeyResponse(
            id=self.key_id,
            subject="Networking",
            exam_name="Midterm",
            faculty_name="Prof. John",
            status="published",
            version=1,
            questions=[self.question],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_deleted=False
        )

        self.mock_answer_key_service.get_answer_key = AsyncMock(return_value=self.answer_key)

        # Configure default prompt mock to avoid MagicMock vs str Pydantic Validation error
        self.prompt_mock = MagicMock()
        self.prompt_mock.system_prompt = "Default system prompt"
        self.prompt_mock.prompt = "Default prompt text"
        self.mock_prompt_service.build_evaluation_prompt.return_value = self.prompt_mock

        self.service = EvaluationService(
            answer_key_service=self.mock_answer_key_service,
            prompt_service=self.mock_prompt_service,
            llm_provider=self.mock_llm_provider,
            response_parser=self.mock_response_parser,
            keyword_service=self.mock_keyword_service
        )

    async def test_evaluation_success(self) -> None:
        
        # Mock LLM provider generate
        llm_response = LLMResponse(
            content='{"marks": 4.0, "feedback": "Nice job", "missing_points": [], "strengths": ["Clear definition"], "confidence": 0.95}',
            provider="mock",
            model="mock-model",
            latency=0.5,
            tokens=120,
            finish_reason="stop"
        )
        self.mock_llm_provider.generate.return_value = llm_response

        # Mock Response Parser
        parsed_mock = LLMEvaluationResponse(
            marks=4.0,
            feedback="Nice job",
            missing_points=[],
            strengths=["Clear definition"],
            confidence=0.95
        )
        self.mock_response_parser.parse_response.return_value = parsed_mock

        # Mock Keywords
        self.mock_keyword_service.extract_matched_keywords.return_value = ["OSI", "layers"]
        self.mock_keyword_service.extract_missing_keywords.return_value = []

        req = EvaluationRequest(
            answer_key_id=str(self.key_id),
            question_number="Q1",
            student_answer="OSI has seven layers."
        )

        res = await self.service.evaluate(req)

        self.assertEqual(res.marks_awarded, 4.0)
        self.assertEqual(res.maximum_marks, 5.0)
        self.assertEqual(res.feedback, "Nice job")
        self.assertEqual(res.matched_keywords, ["OSI", "layers"])
        self.assertEqual(res.missing_keywords, [])
        self.assertEqual(res.evaluated_by, "llm")
        self.mock_llm_provider.generate.assert_called_once()

    async def test_evaluation_partial_marks_disabled(self) -> None:
        self.mock_response_parser.parse_response.return_value = LLMEvaluationResponse(
            marks=3.6,
            feedback="Good",
            missing_points=[],
            strengths=[],
            confidence=0.9
        )
        self.mock_llm_provider.generate.return_value = LLMResponse(content="{}", provider="m", model="m", latency=0.1, tokens=0, finish_reason="stop")

        # Disable partial marks in settings
        with patch("app.services.evaluation_service.settings.ENABLE_PARTIAL_MARKS", False):
            req = EvaluationRequest(
                answer_key_id=str(self.key_id),
                question_number="Q1",
                student_answer="OSI layers"
            )
            res = await self.service.evaluate(req)
            # 3.6 should round to 4.0
            self.assertEqual(res.marks_awarded, 4.0)

    async def test_evaluation_marks_overflow(self) -> None:
        self.mock_response_parser.parse_response.return_value = LLMEvaluationResponse(
            marks=6.0, # exceeds question max of 5.0
            feedback="Too good",
            missing_points=[],
            strengths=[],
            confidence=0.9
        )
        self.mock_llm_provider.generate.return_value = LLMResponse(content="{}", provider="m", model="m", latency=0.1, tokens=0, finish_reason="stop")

        req = EvaluationRequest(
            answer_key_id=str(self.key_id),
            question_number="Q1",
            student_answer="Perfect OSI description"
        )

        with self.assertRaises(MarksOutOfRange):
            await self.service.evaluate(req)

    async def test_evaluation_missing_answer_key(self) -> None:
        self.mock_answer_key_service.get_answer_key.side_effect = AnswerKeyNotFound()

        req = EvaluationRequest(
            answer_key_id=str(uuid4()),
            question_number="Q1",
            student_answer="Hello"
        )
        with self.assertRaises(EvaluationAnswerKeyNotFound):
            await self.service.evaluate(req)

    async def test_evaluation_missing_question(self) -> None:
        self.mock_answer_key_service.get_answer_key.return_value = self.answer_key

        req = EvaluationRequest(
            answer_key_id=str(self.key_id),
            question_number="Q999", # missing
            student_answer="Hello"
        )
        with self.assertRaises(EvaluationQuestionNotFound):
            await self.service.evaluate(req)

    async def test_evaluation_empty_student_answer(self) -> None:
        self.mock_answer_key_service.get_answer_key.return_value = self.answer_key

        req = EvaluationRequest(
            answer_key_id=str(self.key_id),
            question_number="Q1",
            student_answer="    " # whitespace empty
        )

        # Under empty answer, ILLMProvider must NOT be called
        res = await self.service.evaluate(req)

        self.assertEqual(res.marks_awarded, 0.0)
        self.assertEqual(res.maximum_marks, 5.0)
        self.assertEqual(res.feedback, "No answer was provided.")
        self.assertEqual(res.confidence, 1.0)
        self.assertEqual(res.evaluated_by, "system")
        self.mock_llm_provider.generate.assert_not_called()

    async def test_evaluation_provider_failure(self) -> None:
        self.mock_answer_key_service.get_answer_key.return_value = self.answer_key
        self.mock_llm_provider.generate.side_effect = Exception("API Connection failure")

        req = EvaluationRequest(
            answer_key_id=str(self.key_id),
            question_number="Q1",
            student_answer="Network details text"
        )
        with self.assertRaises(EvaluationFailed):
            await self.service.evaluate(req)

    def test_calculate_summary(self) -> None:
        results = [
            {"marks_awarded": 4.5, "maximum_marks": 5.0},
            {"marks_awarded": 3.0, "maximum_marks": 5.0}
        ]
        summary = self.service.calculate_summary(results)
        self.assertEqual(summary.total_marks_awarded, 7.5)
        self.assertEqual(summary.total_maximum_marks, 10.0)
        self.assertEqual(summary.percentage, 75.0)
        self.assertEqual(summary.question_count, 2)
