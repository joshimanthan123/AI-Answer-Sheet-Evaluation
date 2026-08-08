import time
import logging
from app.config import settings
from app.providers.base_provider import ILLMProvider, execute_with_retry
from app.models.llm_models import LLMRequest, LLMResponse, ProviderHealthResponse

logger = logging.getLogger("app.providers.gemini_provider")

class GeminiProvider(ILLMProvider):
    """
    Gemini-specific LLM provider wrapping google-genai Client commands.
    Isolates external package dependencies inside invocation helpers.
    """
    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.timeout = settings.LLM_TIMEOUT_SECONDS
        self.max_retries = settings.LLM_MAX_RETRIES
        self._client = None

    def _get_client(self):
        """
        Lazily creates and resolves the GenAI client instance.
        """
        if not self.api_key:
            from app.core.exceptions import LLMProviderNotConfigured
            raise LLMProviderNotConfigured("Gemini API key is missing. Configure 'GEMINI_API_KEY'.")

        if self._client is None:
            try:
                from google import genai
            except ImportError:
                from app.core.exceptions import LLMProviderError
                raise LLMProviderError("Google GenAI SDK package 'google-genai' is not installed in runtime.")
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def generate(self, request: LLMRequest) -> LLMResponse:
        client = self._get_client()
        
        try:
            from google.genai import types
        except ImportError:
            from app.core.exceptions import LLMProviderError
            raise LLMProviderError("Google GenAI SDK package 'google-genai' is not installed in runtime.")

        # Build payload execution lambda using types.GenerateContentConfig
        async def api_call():
            config = types.GenerateContentConfig(
                system_instruction=request.system_prompt,
                temperature=request.temperature,
                max_output_tokens=request.max_output_tokens,
            )
            return await client.aio.models.generate_content(
                model=self.model,
                contents=request.prompt,
                config=config
            )

        logger.debug("Dispatching request to Gemini: model=%s", self.model)
        start_time = time.time()
        response = await execute_with_retry(
            api_call,
            max_retries=self.max_retries,
            timeout_seconds=self.timeout
        )
        latency = (time.time() - start_time) * 1000.0

        content = getattr(response, "text", "") or ""
        
        # Safe extraction of token usage and metadata
        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", None) if usage else None
        output_tokens = getattr(usage, "candidates_token_count", None) if usage else None
        total_tokens = getattr(usage, "total_token_count", None) if usage else None

        candidates = getattr(response, "candidates", None)
        finish_reason = None
        if candidates and len(candidates) > 0:
            finish_reason = getattr(candidates[0], "finish_reason", None)
            if finish_reason:
                finish_reason = str(finish_reason)

        logger.info(
            "Gemini request complete. model=%s, latency=%.2fms, tokens=%s",
            self.model, latency, total_tokens
        )

        return LLMResponse(
            content=content,
            provider="gemini",
            model=self.model,
            finish_reason=finish_reason,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=round(latency, 2)
        )

    async def health_check(self) -> ProviderHealthResponse:
        if not self.api_key:
            return ProviderHealthResponse(
                provider="gemini",
                available=False,
                model=self.model,
                message="Gemini API key is not configured."
            )

        try:
            self._get_client()
            return ProviderHealthResponse(
                provider="gemini",
                available=True,
                model=self.model,
                message="Gemini provider is configured and initialized."
            )
        except Exception as e:
            return ProviderHealthResponse(
                provider="gemini",
                available=False,
                model=self.model,
                message=f"Gemini health verification failed: {str(e)}"
            )
