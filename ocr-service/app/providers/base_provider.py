import logging
import asyncio
from typing import Any
from abc import ABC, abstractmethod
import numpy as np
from app.models.hwr_models import HWRResult
from app.models.llm_models import LLMRequest, LLMResponse, ProviderHealthResponse
from app.core.exceptions import (
    LLMProviderError,
    LLMProviderUnavailable,
    LLMProviderTimeout,
    LLMProviderAuthenticationError,
    LLMProviderRateLimitError,
    LLMInvalidResponse,
)

logger = logging.getLogger("app.providers.base_provider")

class IHWRProvider(ABC):
    """
    Abstract Base Class (Interface) that all handwriting recognition (HWR) providers
    must implement. Ensures engine-agnostic interactions inside the business logic.
    """
    
    @abstractmethod
    def recognize(self, image: np.ndarray) -> HWRResult:
        pass


class ILLMProvider(ABC):
    """
    Abstract Base Class (Interface) that all LLM providers must implement.
    Ensures provider-agnostic text production and diagnostics.
    """

    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """
        Produce a reply for the specified request prompts and parameters.
        """
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealthResponse:
        """
        Perform a baseline connectivity/status verification.
        """
        pass


async def execute_with_retry(api_call, max_retries: int, timeout_seconds: float) -> Any:
    """
    Utility wrapper to execute arbitrary async provider API requests with bounded retries,
    exponential backoff, timeout ceilings, and unified exception mapping.
    """
    delay = 1.0
    for attempt in range(max_retries + 1):
        try:
            return await asyncio.wait_for(api_call(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            logger.warning("Timeout occurred on attempt %d of %d", attempt + 1, max_retries + 1)
            if attempt == max_retries:
                raise LLMProviderTimeout("LLM request timed out.")
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 10.0)
        except Exception as e:
            err_name = e.__class__.__name__
            err_msg = str(e)
            
            # Authentication issues
            if "AuthenticationError" in err_name or "APIKeyError" in err_name or "Unauthorized" in err_name:
                raise LLMProviderAuthenticationError(f"Provider authentication failed: {err_msg}")
                
            # Rate limit boundaries
            elif "RateLimitError" in err_name or "TooManyRequests" in err_name or "QuotaError" in err_name:
                if attempt == max_retries:
                    raise LLMProviderRateLimitError(f"Provider rate limit exceeded: {err_msg}")
                logger.warning("Rate limit hit on attempt %d. Backing off...", attempt + 1)
                await asyncio.sleep(delay * 2)
                delay = min(delay * 1.5, 10.0)
                
            # Content / structural request errors (Do not retry client-side bugs)
            elif "BadRequestError" in err_name or "InvalidRequestError" in err_name or "ValidationError" in err_name:
                raise LLMProviderError(f"Invalid request parameters submitted: {err_msg}")
                
            # Timeouts
            elif "APITimeoutError" in err_name or "TimeoutException" in err_name:
                if attempt == max_retries:
                    raise LLMProviderTimeout(f"Request timed out: {err_msg}")
                await asyncio.sleep(delay)
                delay = min(delay * 1.5, 10.0)
                
            # Unreachable service / DNS / Socket errors
            elif "APIConnectionError" in err_name or "ConnectionError" in err_name or "ConnectError" in err_name:
                if attempt == max_retries:
                    raise LLMProviderUnavailable(f"Provider endpoint is unreachable: {err_msg}")
                logger.warning("Connection failed on attempt %d. Retrying...", attempt + 1)
                await asyncio.sleep(delay)
                delay = min(delay * 1.5, 10.0)
                
            # Generic catch-all fallback
            else:
                if attempt == max_retries:
                    raise LLMProviderError(f"LLM call failed: {err_msg}")
                logger.warning("Attempt %d encountered retryable error: %s", attempt + 1, err_name)
                await asyncio.sleep(delay)
                delay = min(delay * 1.5, 10.0)
