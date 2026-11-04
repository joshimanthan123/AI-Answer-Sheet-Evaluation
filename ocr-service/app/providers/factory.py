from app.config import settings
from app.providers.base_provider import ILLMProvider
from app.providers.mock_provider import MockLLMProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.gemini_provider import GeminiProvider
from app.core.exceptions import UnsupportedLLMProvider

class LLMProviderFactory:
    """
    Factory interface responsible for resolving and constructing LLM providers.
    """
    @staticmethod
    def create_provider(provider_name: str | None = None) -> ILLMProvider:
        """
        Creates and returns the concrete instance of the requested LLM provider.

        Args:
            provider_name: Override provider name. If None, references `settings.LLM_PROVIDER`.

        Returns:
            ILLMProvider: Concrete provider implementation.

        Raises:
            UnsupportedLLMProvider: If provider_name doesn't match a recognized option.
        """
        if not provider_name:
            provider_name = settings.LLM_PROVIDER

        name = provider_name.lower().strip()
        if name == "mock":
            return MockLLMProvider()
        elif name == "openai":
            return OpenAIProvider()
        elif name == "gemini":
            return GeminiProvider()
        else:
            raise UnsupportedLLMProvider(f"LLM provider '{provider_name}' is not supported. Choose from 'mock', 'openai', or 'gemini'.")
