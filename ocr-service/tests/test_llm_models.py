import unittest
from pydantic import ValidationError
from app.models.llm_models import LLMRequest, LLMResponse, ProviderHealthResponse

class TestLlmModels(unittest.TestCase):
    """
    Test suite for checking validations in LLMRequest, LLMResponse, and ProviderHealthResponse.
    """
    def test_valid_llm_request(self):
        req = LLMRequest(
            system_prompt="You are an AI.",
            prompt="Hello!",
            temperature=0.5,
            max_output_tokens=100
        )
        self.assertEqual(req.system_prompt, "You are an AI.")
        self.assertEqual(req.temperature, 0.5)
        self.assertEqual(req.max_output_tokens, 100)

    def test_default_values(self):
        req = LLMRequest(
            system_prompt="You are an AI.",
            prompt="Hello!"
        )
        self.assertEqual(req.temperature, 0.0)
        self.assertEqual(req.max_output_tokens, 2048)

    def test_empty_system_prompt(self):
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="", prompt="Hello!")
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="   ", prompt="Hello!")

    def test_empty_prompt(self):
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="")
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="   ")

    def test_invalid_temperature_bounds(self):
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="Hello", temperature=-0.1)
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="Hello", temperature=2.1)

    def test_invalid_max_output_tokens(self):
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="Hello", max_output_tokens=0)
        with self.assertRaises(ValidationError):
            LLMRequest(system_prompt="AI", prompt="Hello", max_output_tokens=-5)

    def test_valid_llm_response(self):
        res = LLMResponse(
            content="Hello world",
            provider="mock",
            model="mock-model",
            finish_reason="stop",
            input_tokens=10,
            output_tokens=20,
            total_tokens=30,
            latency_ms=1.5
        )
        self.assertEqual(res.content, "Hello world")
        self.assertEqual(res.total_tokens, 30)

    def test_optional_usage_fields(self):
        res = LLMResponse(
            content="Hello world",
            provider="mock",
            model="mock-model"
        )
        self.assertIsNone(res.finish_reason)
        self.assertIsNone(res.input_tokens)
        self.assertIsNone(res.output_tokens)
        self.assertIsNone(res.latency_ms)

    def test_provider_health_response(self):
        health = ProviderHealthResponse(
            provider="mock",
            available=True,
            model="mock-model",
            message="healthy"
        )
        self.assertTrue(health.available)
        self.assertEqual(health.message, "healthy")
