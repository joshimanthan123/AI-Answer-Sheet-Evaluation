import unittest
from app.config import settings
from app.dependencies import get_llm_provider
from app.providers.mock_provider import MockLLMProvider
from app.providers.openai_provider import OpenAIProvider
from app.core.exceptions import LLMProviderNotConfigured

class TestLlmDependencies(unittest.TestCase):
    """
    Test suite verifying FastAPI dependency injection for LLM providers.
    """
    def setUp(self):
        self._og_provider = settings.LLM_PROVIDER
        self._og_openai_key = settings.OPENAI_API_KEY

    def tearDown(self):
        settings.LLM_PROVIDER = self._og_provider
        settings.OPENAI_API_KEY = self._og_openai_key

    def test_get_llm_provider_default_mock(self):
        settings.LLM_PROVIDER = "mock"
        provider = get_llm_provider()
        self.assertIsInstance(provider, MockLLMProvider)

    def test_get_llm_provider_openai_throws_when_keys_missing(self):
        settings.LLM_PROVIDER = "openai"
        settings.OPENAI_API_KEY = None
        
        provider = get_llm_provider()
        # Initializing client or using it should trigger config err
        with self.assertRaises(LLMProviderNotConfigured):
            provider._get_client()

    def test_get_llm_provider_resolves_openai_when_configured(self):
        settings.LLM_PROVIDER = "openai"
        settings.OPENAI_API_KEY = "mock-key-value"
        
        provider = get_llm_provider()
        self.assertIsInstance(provider, OpenAIProvider)
        self.assertEqual(provider.api_key, "mock-key-value")
