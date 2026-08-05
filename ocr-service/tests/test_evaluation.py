import os
import sys
import time
import json
import unittest
from unittest.mock import patch, MagicMock
import httpx

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.models.evaluation_models import EvaluationCriteria, EvaluatedAnswer, EvaluationResult
from app.services.keyword_service import KeywordService
from app.services.similarity_service import SimilarityService
from app.services.prompt_builder import PromptBuilder
from app.services.evaluation_service import AnswerEvaluationService
from app.providers.mock_llm_provider import MockLLMProvider
from app.providers.openai_provider import OpenAIProvider, OpenAIProviderError
from app.providers.azure_llm_provider import AzureLLMProvider, AzureOpenAIProviderError

class TestEvaluationEngine(unittest.TestCase):
    """
    Test suite verifying keyword scoring, similarity computations, prompt templates,
    LLM providers (mock, OpenAI, Azure), retries, timeouts, and evaluation orchestrations.
    """

    def setUp(self):
        # Backups to prevent leakage
        self._backup_llm_provider = settings.LLM_PROVIDER
        self._backup_llm_model = settings.LLM_MODEL
        self._backup_max_retries = settings.LLM_MAX_RETRIES
        self._backup_similarity_threshold = settings.SIMILARITY_THRESHOLD

        settings.LLM_PROVIDER = "mock"
        settings.LLM_MODEL = "gpt-4.1"
        settings.LLM_MAX_RETRIES = 2

    def tearDown(self):
        settings.LLM_PROVIDER = self._backup_llm_provider
        settings.LLM_MODEL = self._backup_llm_model
        settings.LLM_MAX_RETRIES = self._backup_max_retries
        settings.SIMILARITY_THRESHOLD = self._backup_similarity_threshold

    # -------------------------------------------------------------
    # 1. Keyword Service Tests
    # -------------------------------------------------------------
    def test_keyword_service_basic_matching(self):
        student_ans = "Machine Learning is a subset of Artificial Intelligence."
        keywords = ["Machine learning", "Artificial Intelligence", "random_term"]

        # Expected:
        # cleaned keywords are matched. "Machine learning" (phrase match), "Artificial Intelligence" (phrase match).
        # "random_term" (not matched). Score: 2 / 3 = 0.6667
        score = KeywordService.evaluate_keywords(student_ans, keywords)
        self.assertAlmostEqual(score, 0.6667, places=3)

    def test_keyword_service_empty_cases(self):
        # Empty expected list returns 1.0 (default pass)
        score_empty_kw = KeywordService.evaluate_keywords("some text", [])
        self.assertEqual(score_empty_kw, 1.0)

        # Empty student text returns 0.0
        score_empty_ans = KeywordService.evaluate_keywords("   ", ["AI"])
        self.assertEqual(score_empty_ans, 0.0)

    # -------------------------------------------------------------
    # 2. Similarity Service Tests
    # -------------------------------------------------------------
    def test_similarity_service_flow(self):
        text1 = "artificial intelligence simulation of human intellect"
        text2 = "artificial intelligence is the simulation of human intelligence"

        sim = SimilarityService.compute_similarity(text1, text2)
        # Verify it falls in range
        self.assertTrue(0.0 <= sim <= 1.0)
        self.assertGreater(sim, 0.70) # highly similar text

        comp = SimilarityService.compute_completeness(text1, text2)
        # text1 is 6 words, text2 is 8 words. ratio = 6/8 = 0.75
        self.assertEqual(comp, 0.75)

    def test_similarity_service_empty_cases(self):
        self.assertEqual(SimilarityService.compute_similarity("", "valid text"), 0.0)
        self.assertEqual(SimilarityService.compute_similarity("valid text", ""), 0.0)
        self.assertEqual(SimilarityService.compute_completeness("", "valid text"), 0.0)
        self.assertEqual(SimilarityService.compute_completeness("valid text", ""), 1.0)

    # -------------------------------------------------------------
    # 3. Prompt Builder Caching Tests
    # -------------------------------------------------------------
    def test_prompt_builder_formatting(self):
        criteria = EvaluationCriteria(
            maximum_marks=5.0,
            passing_marks=2.0,
            keyword_weight=0.3,
            semantic_weight=0.4,
            completeness_weight=0.3
        )
        prompt = PromptBuilder.build_user_prompt(
            question="What is NLP?",
            student_answer="Natural Language Processing",
            reference_answer="NLP is natural language processing.",
            criteria=criteria,
            keywords=["NLP", "Language"]
        )

        self.assertIn("What is NLP?", prompt)
        self.assertIn("Natural Language Processing", prompt)
        self.assertIn("Passing Marks: 2.0", prompt)
        self.assertIn("Maximum Marks: 5.0", prompt)

    # -------------------------------------------------------------
    # 4. Mock Provider Tests
    # -------------------------------------------------------------
    def test_mock_llm_provider_determinsitic(self):
        provider = MockLLMProvider()
        criteria = EvaluationCriteria(
            maximum_marks=10.0,
            passing_marks=4.0,
            keyword_weight=0.0,
            semantic_weight=1.0,
            completeness_weight=0.0
        )

        res = provider.evaluate_answer(
            question="Define AI.",
            student_answer="AI is artificial intelligence.",
            reference_answer="AI is artificial intelligence.",
            criteria=criteria,
            keywords=[]
        )

        # Since it's identical match, similarity = 1.0, awarded marks = 10.0
        self.assertEqual(res["awarded_marks"], 10.0)
        self.assertIn("mock", res["provider_metadata"]["provider"])
        self.assertEqual(len(res["improvements"]), 0)

    # -------------------------------------------------------------
    # 5. OpenAI Provider Tests
    # -------------------------------------------------------------
    @patch("httpx.post")
    @patch("app.config.settings.OPENAI_API_KEY", "mock-key")
    def test_openai_provider_success(self, mock_post):
        # Mocking HTTPX response details
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "awarded_marks": 4.5,
                        "reasoning": "Excellent clear response",
                        "feedback": "Keep it up",
                        "strengths": ["Clear definitions"],
                        "improvements": []
                    })
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150
            }
        }
        mock_post.return_value = mock_response

        provider = OpenAIProvider()
        criteria = EvaluationCriteria(
            maximum_marks=5.0,
            passing_marks=2.0,
            keyword_weight=0.3,
            semantic_weight=0.4,
            completeness_weight=0.3
        )
        res = provider.evaluate_answer("Q1", "student text", "ref text", criteria, [])
        
        self.assertEqual(res["awarded_marks"], 4.5)
        self.assertEqual(res["reasoning"], "Excellent clear response")
        self.assertEqual(res["provider_metadata"]["prompt_tokens"], 100)

    @patch("httpx.post")
    @patch("app.config.settings.OPENAI_API_KEY", "mock-key")
    def test_openai_provider_retries_and_failures(self, mock_post):
        mock_response_fail = MagicMock()
        mock_response_fail.status_code = 429
        mock_response_fail.text = "Rate Limit Exceeded"
        
        mock_post.return_value = mock_response_fail
        
        provider = OpenAIProvider()
        criteria = EvaluationCriteria(
            maximum_marks=5.0,
            passing_marks=2.0,
            keyword_weight=0.3,
            semantic_weight=0.4,
            completeness_weight=0.3
        )

        with patch("time.sleep", return_value=None):
            with self.assertRaises(OpenAIProviderError):
                provider.evaluate_answer("Q1", "student text", "ref text", criteria, [])

    @patch("httpx.post")
    @patch("app.config.settings.OPENAI_API_KEY", "mock-key")
    def test_openai_provider_invalid_json_handling(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": "Not a JSON block"
                }
            }]
        }
        mock_post.return_value = mock_response
        
        provider = OpenAIProvider()
        criteria = EvaluationCriteria(
            maximum_marks=5.0,
            passing_marks=2.0,
            keyword_weight=0.3,
            semantic_weight=0.4,
            completeness_weight=0.3
        )

        with self.assertRaises(OpenAIProviderError):
            provider.evaluate_answer("Q1", "student text", "ref text", criteria, [])

    # -------------------------------------------------------------
    # 6. Azure LLM Provider Tests
    # -------------------------------------------------------------
    @patch("httpx.post")
    @patch("app.config.settings.AZURE_OPENAI_ENDPOINT", "https://mock.azure.openai.com")
    @patch("app.config.settings.AZURE_OPENAI_API_KEY", "azure-mock-key")
    @patch("app.config.settings.AZURE_OPENAI_DEPLOYMENT", "deploy-mock")
    def test_azure_llm_provider_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "awarded_marks": 7.0,
                        "reasoning": "Azure OpenAI check succeeded",
                        "feedback": "Acceptable details",
                        "strengths": ["Structured layout"],
                        "improvements": ["Minor details missing"]
                    })
                }
            }],
            "usage": {
                "total_tokens": 80
            }
        }
        mock_post.return_value = mock_response

        provider = AzureLLMProvider()
        criteria = EvaluationCriteria(
            maximum_marks=10.0,
            passing_marks=4.0,
            keyword_weight=0.3,
            semantic_weight=0.4,
            completeness_weight=0.3
        )
        res = provider.evaluate_answer("Q2", "student answer", "ref response", criteria, [])
        
        self.assertEqual(res["awarded_marks"], 7.0)
        self.assertEqual(res["provider_metadata"]["provider"], "azure")

    # -------------------------------------------------------------
    # 7. Evaluation Service Orchestration Tests
    # -------------------------------------------------------------
    def test_evaluation_orchestrator_success(self):
        settings.LLM_PROVIDER = "mock"

        student_answers = [
            {"question_number": "1", "student_answer": "AI is subset of intelligence", "confidence": 0.98},
            {"question_number": "2", "student_answer": "ML matches features", "confidence": 0.85}
        ]

        reference_keys = {
            "1": {"reference_answer": "AI is subset of intelligence", "maximum_marks": 10.0, "keywords": ["AI"]},
            "2": {"reference_answer": "ML is Machine learning matches features", "maximum_marks": 5.0, "keywords": ["ML"]}
        }

        res = AnswerEvaluationService.evaluate_student_answers(
            exam_id="EXAM-101",
            student_id="STUD-808",
            student_answers=student_answers,
            reference_keys=reference_keys
        )

        self.assertEqual(res.status, "SUCCESS")
        self.assertEqual(res.exam_id, "EXAM-101")
        self.assertEqual(res.student_id, "STUD-808")
        self.assertEqual(res.maximum_marks, 15.0)
        self.assertGreater(res.total_marks, 0.0)
        self.assertGreater(res.average_similarity, 0.5)
        self.assertEqual(len(res.warnings), 0)

    def test_evaluation_orchestrator_empty_answers(self):
        student_answers = [
            {"question_number": "1", "student_answer": "", "confidence": 1.0}
        ]
        reference_keys = {
            "1": {"reference_answer": "Expected exact answer", "maximum_marks": 5.0}
        }

        res = AnswerEvaluationService.evaluate_student_answers(
            exam_id="EXAM-102",
            student_id="STUD-909",
            student_answers=student_answers,
            reference_keys=reference_keys
        )

        self.assertEqual(res.total_marks, 0.0)
        self.assertEqual(res.evaluated_answers[0].awarded_marks, 0.0)
        self.assertEqual(res.evaluated_answers[0].cognitive_score if hasattr(res.evaluated_answers[0], 'cognitive_score') else 0.0, 0.0)
        self.assertEqual(res.evaluated_answers[0].feedback, "No answer provided.")

    @patch("httpx.post")
    def test_evaluation_orchestrator_fallback_on_llm_failure(self, mock_post):
        # Configure service to query "openai" provider which will fail due to request error
        settings.LLM_PROVIDER = "openai"
        # Patch API key to a mock value so initialization succeeds
        with patch("app.config.settings.OPENAI_API_KEY", "mock-key"):
            mock_post.side_effect = httpx.RequestError("Mock network connection failed")

            student_answers = [
                {"question_number": "1", "student_answer": "Some answer text", "confidence": 0.95}
            ]
            reference_keys = {
                "1": {"reference_answer": "Some answer reference text", "maximum_marks": 10.0, "keywords": ["answer"]}
            }

            res = AnswerEvaluationService.evaluate_student_answers(
                exam_id="EXAM-FB",
                student_id="STUD-FB",
                student_answers=student_answers,
                reference_keys=reference_keys
            )

            # Verification: status should be PARTIAL_SUCCESS and it should fallback to algorithmic scoring without failing
            self.assertEqual(res.status, "PARTIAL_SUCCESS")
            self.assertTrue(any("fallback" in w.lower() or "openai" in w.lower() for w in res.warnings))
            self.assertEqual(res.maximum_marks, 10.0)
            self.assertGreater(res.total_marks, 0.0) # computed programmatically!
            self.assertTrue(res.evaluated_answers[0].provider_metadata.get("fallback", False))

    # -------------------------------------------------------------
    # 8. Performance Benchmarking Test
    # -------------------------------------------------------------
    def test_performance_benchmarking(self):
        settings.LLM_PROVIDER = "mock"
        student_answers = [{"question_number": "1", "student_answer": "AI", "confidence": 0.9}]
        reference_keys = {"1": {"reference_answer": "AI", "maximum_marks": 10.0}}

        start = time.time()
        res = AnswerEvaluationService.evaluate_student_answers("PERF", "STUD-99", student_answers, reference_keys)
        duration = time.time() - start

        self.assertLess(duration, 0.5)  # should execute within 500ms since mock sleep is ~100ms
        self.assertEqual(res.processing_provider, "mock")
        print(f"\n=> Benchmarked Performance Duration: {res.execution_time}s")


if __name__ == "__main__":
    unittest.main()
