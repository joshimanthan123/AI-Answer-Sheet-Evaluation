import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

class TestLlmRoutes(unittest.TestCase):
    """
    Integration tests testing FastAPI routing endpoints under /api/v1/llm.
    """
    def setUp(self):
        self.client = TestClient(app)
        self._og_provider = settings.LLM_PROVIDER
        settings.LLM_PROVIDER = "mock"

    def tearDown(self):
        settings.LLM_PROVIDER = self._og_provider

    def test_health_endpoint(self):
        response = self.client.get("/api/v1/llm/health")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertTrue(json_data["success"])
        self.assertEqual(json_data["data"]["provider"], "mock")
        self.assertTrue(json_data["data"]["available"])
        self.assertEqual(json_data["data"]["model"], "mock-model")

    def test_generate_endpoint_success(self):
        payload = {
            "system_prompt": "You are a grading assistant.",
            "prompt": "Evaluate: Machine Learning is subset of AI.",
            "temperature": 0.0,
            "max_output_tokens": 1024
        }
        response = self.client.post("/api/v1/llm/generate", json=payload)
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertTrue(json_data["success"])
        self.assertEqual(json_data["data"]["provider"], "mock")
        self.assertIn("marks", json_data["data"]["content"])

    def test_generate_endpoint_empty_prompt_validation_error(self):
        payload = {
            "system_prompt": "You are a grading assistant.",
            "prompt": "   " # whitespace / empty is invalid
        }
        response = self.client.post("/api/v1/llm/generate", json=payload)
        self.assertEqual(response.status_code, 400)
        json_data = response.json()
        self.assertFalse(json_data["success"])
        self.assertIn("Validation failed", json_data["message"])
