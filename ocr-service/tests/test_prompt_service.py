import os
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.core.exceptions import (
    PromptTemplateNotFound,
    PromptTemplateInvalid,
    PromptPlaceholderMissing,
    PromptTooLarge,
)
from app.models.prompt_models import (
    PromptType,
    EvaluationPromptRequest,
    KeywordPromptRequest,
    FeedbackPromptRequest,
)
from app.services.prompt_service import PromptService
from app.dependencies import get_prompt_service


class TestPromptService(unittest.TestCase):
    """
    Unit test suite verifying prompt rendering, placeholder rules, caching, and hot Reloading.
    """

    def setUp(self):
        # Point settings template dir to tests dummy dir or backup and restore
        self.original_dir = settings.PROMPT_TEMPLATE_DIR
        self.test_dir = Path(__file__).resolve().parent / "dummy_prompts"
        self.test_dir.mkdir(exist_ok=True)
        settings.PROMPT_TEMPLATE_DIR = str(self.test_dir)

        # Create basic valid templates
        self.write_dummy_template(PromptType.SYSTEM, "You are an examiner.")
        self.write_dummy_template(
            PromptType.EVALUATION,
            "Q: ${question}, Marks: ${maximum_marks}, Model: ${model_answer}, KW: ${keywords}, Rubric: ${rubric}, Student: ${student_answer}",
        )
        self.write_dummy_template(PromptType.KEYWORD, "Answer: ${model_answer}")
        self.write_dummy_template(
            PromptType.FEEDBACK,
            "Score: ${marks}, Strengths: ${strengths}, Missing: ${missing_points}",
        )

        self.service = PromptService()

    def tearDown(self):
        # Cleanup dummy dir
        if self.test_dir.exists():
            for f in self.test_dir.glob("*.txt"):
                f.unlink()
            self.test_dir.rmdir()
        settings.PROMPT_TEMPLATE_DIR = self.original_dir

    def write_dummy_template(self, prompt_type: PromptType, content: str, lang: str = "en"):
        filename = f"{prompt_type.value}_prompt.txt"
        filepath = self.test_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def test_load_templates_success(self):
        """Verify templates load from disk during boot initialization."""
        self.assertIn(PromptType.SYSTEM, self.service._template_cache)
        self.assertIn(PromptType.EVALUATION, self.service._template_cache)
        self.assertIn(PromptType.KEYWORD, self.service._template_cache)
        self.assertIn(PromptType.FEEDBACK, self.service._template_cache)

    def test_build_evaluation_prompt_success(self):
        """Verify successful rendering and keyword normalization from request payload."""
        req = EvaluationPromptRequest(
            question="What is TCP?",
            student_answer="Transmission Control Protocol",
            model_answer="TCP is connection oriented",
            maximum_marks=5.0,
            keywords=["TCP", "Protocol"],
            rubric="Check for connection aspects.",
        )
        res = self.service.build_evaluation_prompt(req)
        self.assertEqual(res.system_prompt, "You are an examiner.")
        self.assertIn("Q: What is TCP", res.prompt)
        self.assertIn("Marks: 5.0", res.prompt)
        self.assertIn("KW: TCP, Protocol", res.prompt) # normalized keywords!
        self.assertEqual(res.metadata["template_name"], "evaluation")
        self.assertEqual(res.metadata["placeholder_count"], 6)

    def test_build_evaluation_prompt_empty_falls(self):
        """Verify fallback strings for empty rubric, keywords, or student answer."""
        req = EvaluationPromptRequest(
            question="What is TCP?",
            student_answer="   ",  # whitespace only
            model_answer="TCP details",
            maximum_marks=10.0,
            keywords=[],
            rubric="   ",  # whitespace only
        )
        res = self.service.build_evaluation_prompt(req)
        self.assertIn("KW: None specified", res.prompt)
        self.assertIn("Rubric: None provided", res.prompt)
        self.assertIn("Student: [No answer provided]", res.prompt)

    def test_build_keyword_prompt_success(self):
        """"Verify rendering keyword extraction prompt output."""
        req = KeywordPromptRequest(model_answer="Mock database index explanation")
        res = self.service.build_keyword_prompt(req)
        self.assertEqual(res.system_prompt, "You are an examiner.")
        self.assertEqual(res.prompt, "Answer: Mock database index explanation")

    def test_build_feedback_prompt_success(self):
        """Verify rendering feedback compile output."""
        req = FeedbackPromptRequest(
            marks=4.5,
            strengths=["Concise representation", "Clean drawing"],
            missing_points=["Missing context layer"],
        )
        res = self.service.build_feedback_prompt(req)
        self.assertEqual(res.prompt, "Score: 4.5, Strengths: Concise representation, Clean drawing, Missing: Missing context layer")

    def test_missing_template_throws(self):
        """Verify PromptTemplateNotFound raised when files are physically deleted."""
        filepath = self.test_dir / "keyword_prompt.txt"
        if filepath.exists():
            filepath.unlink()
        
        # Flush path cache should throw PromptTemplateNotFound
        with self.assertRaises(PromptTemplateNotFound):
            self.service.reload_templates()

    def test_invalid_template_structure_raises(self):
        """Verify PromptTemplateInvalid raised when templates lack required fields or contain extra ones."""
        # 1. Missing a required placeholder
        self.write_dummy_template(PromptType.KEYWORD, "No model answer context.")
        with self.assertRaises(PromptTemplateInvalid):
            self.service.reload_templates()

        # 2. Unknown placeholder present
        self.write_dummy_template(PromptType.KEYWORD, "Answer: ${model_answer} and ${extra_stuff}")
        with self.assertRaises(PromptTemplateInvalid):
            self.service.reload_templates()

    def test_render_placeholder_missing_runtime_assertion(self):
        """Verify PromptPlaceholderMissing raises at service boundaries if mapping is missing."""
        # If we render template bypass, or simulate missing render variables
        with self.assertRaises(PromptPlaceholderMissing):
            self.service._render_template(PromptType.KEYWORD, {})

    def test_prompt_too_large_exception(self):
        """Verify PromptTooLarge raised if rendered prompt character length exceeds setting boundaries."""
        req = KeywordPromptRequest(model_answer="X" * 30000) # settings.MAX_PROMPT_TOKENS = 6000 => limit is 24000
        with self.assertRaises(PromptTooLarge):
            self.service.build_keyword_prompt(req)

    def test_hot_reload_functionality(self):
        """Verify automatic hot-reload updates cache without service interruption."""
        req = KeywordPromptRequest(model_answer="Original Model Answer")
        res1 = self.service.build_keyword_prompt(req)
        self.assertEqual(res1.prompt, "Answer: Original Model Answer")

        # Edit template file
        filepath = self.test_dir / "keyword_prompt.txt"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("Revised Answer: ${model_answer}")

        # Artificially shift modification time of the file into future so it differs
        future_mtime = time.time() + 10
        os.utime(filepath, (future_mtime, future_mtime))

        res2 = self.service.build_keyword_prompt(req)
        self.assertEqual(res2.prompt, "Revised Answer: Original Model Answer")


class TestPromptRouter(unittest.TestCase):
    """
    Integration test suite verifying API routes.
    """

    def setUp(self):
        self.client = TestClient(app)
        # Ensure latest real templates on app boot are loaded
        service = get_prompt_service()
        service.reload_templates()

    def test_router_evaluation_success(self):
        """Verify POST /api/v1/prompts/evaluation compiles prompt."""
        payload = {
            "question": "What is Python?",
            "student_answer": "Python is a programming language.",
            "model_answer": "Python is high-level scripting language.",
            "maximum_marks": 5.0,
            "keywords": ["Scripting", "High-level"],
            "rubric": "Correct semantics",
        }
        res = self.client.post("/api/v1/prompts/evaluation", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertIn("prompt", body["data"])
        self.assertEqual(body["data"]["metadata"]["template_name"], "evaluation")

    def test_router_evaluation_validation_failure(self):
        """Verify validation errors are handled correctly."""
        payload = {
            "question": "   ",  # invalid whitespace
            "student_answer": "Python is nice.",
            "model_answer": "Python scripting",
            "maximum_marks": -10.0,  # invalid marks
        }
        res = self.client.post("/api/v1/prompts/evaluation", json=payload)
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body["success"])

    def test_router_keywords_success(self):
        """Verify POST /api/v1/prompts/keywords compiles prompt."""
        payload = {"model_answer": "Reference model answer text"}
        res = self.client.post("/api/v1/prompts/keywords", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertIn("keywords", body["data"]["prompt"])

    def test_router_feedback_success(self):
        """Verify POST /api/v1/prompts/feedback compiles prompt."""
        payload = {
            "marks": 4.5,
            "strengths": ["Clean logic"],
            "missing_points": ["No tests shown"],
        }
        res = self.client.post("/api/v1/prompts/feedback", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])

    def test_reload_templates_success(self):
        """Verify POST /api/v1/prompts/reload operation succeeds."""
        res = self.client.post("/api/v1/prompts/reload")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["message"], "Prompt templates reloaded successfully.")
