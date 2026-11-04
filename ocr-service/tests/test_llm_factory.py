import unittest
from app.config import settings
from app.providers.factory import LLMProviderFactory
from app.providers.mock_provider import MockLLMProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.gemini_provider import GeminiProvider
from app.core.exceptions import UnsupportedLLMProvider

class TestLlmFactory(unittest.TestCase):
    """
    Test suite verifying provider construction via factory pattern.
    """
    def test_factory_resolutions(self):
        # Explicit calls
        provider_mock = LLMProviderFactory.create_provider("mock")
        self.assertIsInstance(provider_mock, MockLLMProvider)

        provider_openai = LLMProviderFactory.create_provider("openai")
        self.assertIsInstance(provider_openai, OpenAIProvider)

        provider_gemini = LLMProviderFactory.create_provider("gemini")
        self.assertIsInstance(provider_gemini, GeminiProvider)

    def test_factory_default(self):
        # Default config lookup
        settings.LLM_PROVIDER = "mock"
        provider = LLMProviderFactory.create_provider()
        self.assertIsInstance(provider, MockLLMProvider)

    def test_factory_invalid_provider(self):
        with self.assertRaises(UnsupportedLLMProvider):
            LLMProviderFactory.create_provider("invalid-llm")
        with self.assertRaises(UnsupportedLLMProvider):
            LLMProviderFactory.create_provider("azure_openai")  # not in the requested 3C list
