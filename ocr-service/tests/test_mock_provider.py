import unittest
import json
from app.providers.mock_provider import MockLLMProvider
from app.models.llm_models import LLMRequest

class TestMockProvider(unittest.IsolatedAsyncioTestCase):
    """
    Test suite for MockLLMProvider verification.
    """
    def setUp(self):
        self.provider = MockLLMProvider()

    async def test_mock_generation(self):
        req = LLMRequest(
            system_prompt="system template",
            prompt="student response"
        )
        response = await self.provider.generate(req)
        self.assertEqual(response.provider, "mock")
        self.assertEqual(response.model, "mock-model")
        
        # Test content determinism
        content_dict = json.loads(response.content)
        self.assertEqual(content_dict["marks"], 4)
        self.assertEqual(content_dict["confidence"], 0.92)
        self.assertIn("Correct definition", content_dict["strengths"])

    async def test_mock_health(self):
        health = await self.provider.health_check()
        self.assertTrue(health.available)
        self.assertEqual(health.provider, "mock")
        self.assertEqual(health.model, "mock-model")
