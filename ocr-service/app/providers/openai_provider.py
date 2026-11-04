import time
import json
import logging
import httpx
from typing import Dict, Any, List

from app.config import settings
from app.providers.base_provider import ILLMProvider, execute_with_retry
from app.models.llm_models import LLMRequest, LLMResponse, ProviderHealthResponse
from app.models.evaluation_models import EvaluationCriteria
from app.services.prompt_builder import PromptBuilder

logger = logging.getLogger("app.providers.openai_provider")

class OpenAIProviderError(Exception):
    """Custom exception raised when OpenAI API interactions fail."""
    pass

class OpenAIProvider(ILLMProvider):
    """
    OpenAI-specific LLM provider wrapping AsyncOpenAI client commands.
    Isolates external package dependencies inside invocation helpers.
    Includes legacy sync methods for Phase 3B backward compatibility.
    """
    def __init__(self) -> None:
        self._client = None
        self.api_url = "https://api.openai.com/v1/chat/completions"

    @property
    def api_key(self) -> str | None:
        return settings.OPENAI_API_KEY

    @property
    def model(self) -> str:
        return settings.OPENAI_MODEL

    @property
    def base_url(self) -> str | None:
        return settings.OPENAI_BASE_URL

    @property
    def timeout(self) -> float:
        return settings.LLM_TIMEOUT_SECONDS

    @property
    def max_retries(self) -> int:
        return settings.LLM_MAX_RETRIES

    def _get_client(self):
        """
        Lazily creates and resolves the AsyncOpenAI client instance.
        """
        if not self.api_key:
            from app.core.exceptions import LLMProviderNotConfigured
            raise LLMProviderNotConfigured("OpenAI API key is missing. Configure 'OPENAI_API_KEY'.")

        if self._client is None:
            try:
                from openai import AsyncOpenAI
            except ImportError:
                from app.core.exceptions import LLMProviderError
                raise LLMProviderError("OpenAI SDK package 'openai' is not installed in runtime.")
            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    async def generate(self, request: LLMRequest) -> LLMResponse:
        client = self._get_client()

        # Build payload execution lambda
        async def api_call():
            return await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.prompt}
                ],
                model=self.model,
                temperature=request.temperature,
                max_tokens=request.max_output_tokens
            )

        logger.debug("Dispatching request to OpenAI: model=%s", self.model)
        start_time = time.time()
        chat_completion = await execute_with_retry(
            api_call,
            max_retries=self.max_retries,
            timeout_seconds=self.timeout
        )
        latency = (time.time() - start_time) * 1000.0

        content = chat_completion.choices[0].message.content
        finish_reason = chat_completion.choices[0].finish_reason
        usage = chat_completion.usage
        
        input_tokens = usage.prompt_tokens if usage else None
        output_tokens = usage.completion_tokens if usage else None
        total_tokens = usage.total_tokens if usage else None

        logger.info(
            "OpenAI request complete. model=%s, latency=%.2fms, tokens=%s",
            chat_completion.model, latency, total_tokens
        )

        return LLMResponse(
            content=content or "",
            provider="openai",
            model=chat_completion.model or self.model,
            finish_reason=finish_reason,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=round(latency, 2)
        )

    async def health_check(self) -> ProviderHealthResponse:
        if not self.api_key:
            return ProviderHealthResponse(
                provider="openai",
                available=False,
                model=self.model,
                message="OpenAI API key is not configured."
            )

        try:
            self._get_client()
            return ProviderHealthResponse(
                provider="openai",
                available=True,
                model=self.model,
                message="OpenAI provider is configured and initialized."
            )
        except Exception as e:
            return ProviderHealthResponse(
                provider="openai",
                available=False,
                model=self.model,
                message=f"OpenAI health verification failed: {str(e)}"
            )

    # =========================================================================
    # Legacy Sync Methods for Phase 3B Backward Compatibility
    # =========================================================================

    def _call_api_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes HTTP call with client retries and exponential backoff (Legacy sync).
        """
        if not self.api_key:
            raise OpenAIProviderError("OpenAI API key is missing. Set OPENAI_API_KEY environment variable.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        last_exception = None
        current_delay = 1.0

        # We fallback to settings.LLM_TIMEOUT or self.timeout
        timeout_val = getattr(settings, "LLM_TIMEOUT", self.timeout)

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info("Calling OpenAI API (Attempt %d/%d) via sync pipeline", attempt, self.max_retries)
                response = httpx.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=timeout_val
                )
                
                if response.status_code == 200:
                    return response.json()
                
                logger.warning("OpenAI API returned HTTP %d: %s", response.status_code, response.text)
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt == self.max_retries:
                        raise OpenAIProviderError(f"OpenAI API call failed after max retries. HTTP Status: {response.status_code}, Response: {response.text}")
                    time.sleep(current_delay)
                    current_delay *= 2.0
                    continue
                else:
                    raise OpenAIProviderError(f"OpenAI API request failed (HTTP {response.status_code}): {response.text}")
                    
            except httpx.RequestError as e:
                logger.warning("Network connection failure during call: %s", str(e))
                last_exception = e
                if attempt == self.max_retries:
                    raise OpenAIProviderError(f"OpenAI API network failure: {str(e)}") from e
                time.sleep(current_delay)
                current_delay *= 2.0
                
        raise OpenAIProviderError("OpenAI API call failed due to an unexpected loop completion.")

    def evaluate_answer(
        self,
        question: str,
        student_answer: str,
        reference_answer: str,
        criteria: EvaluationCriteria,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluates the student answer using GPT Chat Completion (Legacy sync).
        """
        user_prompt = PromptBuilder.build_user_prompt(
            question=question,
            student_answer=student_answer,
            reference_answer=reference_answer,
            criteria=criteria,
            keywords=keywords
        )

        messages = [
            {
                "role": "system",
                "content": "You are a professional academic evaluation engine. Return structural evaluation details in JSON only."
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]

        # Use settings.LLM_MODEL for old grading pipeline
        payload = {
            "model": settings.LLM_MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }

        start_time = time.time()
        api_response = self._call_api_with_retry(payload)
        latency = round(time.time() - start_time, 4)

        try:
            choice = api_response["choices"][0]
            content = choice["message"]["content"]
            parsed_data = json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error("Failed to parse structured JSON from OpenAI response: %s", str(e))
            raise OpenAIProviderError(f"Failed to parse structured response from LLM: {str(e)}") from e

        awarded_marks = parsed_data.get("awarded_marks")
        reasoning = parsed_data.get("reasoning", "No LLM reasoning provided.")
        feedback = parsed_data.get("feedback", "No LLM feedback provided.")
        strengths = parsed_data.get("strengths", [])
        improvements = parsed_data.get("improvements", [])

        try:
            awarded_marks = float(awarded_marks)
        except (TypeError, ValueError):
            awarded_marks = 0.0

        awarded_marks = max(0.0, min(criteria.maximum_marks, awarded_marks))

        if not isinstance(strengths, list):
            strengths = [str(strengths)] if strengths else []
        if not isinstance(improvements, list):
            improvements = [str(improvements)] if improvements else []

        usage = api_response.get("usage", {})

        return {
            "awarded_marks": awarded_marks,
            "reasoning": reasoning,
            "feedback": feedback,
            "strengths": [str(s) for s in strengths],
            "improvements": [str(i) for i in improvements],
            "provider_metadata": {
                "provider": "openai",
                "model": settings.LLM_MODEL,
                "latency": latency,
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "finish_reason": choice.get("finish_reason", "completed"),
                "prompt_version": settings.PROMPT_VERSION
            }
        }

    def generate_feedback(
        self,
        student_answer: str,
        reference_answer: str,
        awarded_marks: float,
        maximum_marks: float
    ) -> str:
        """
        Queries OpenAI Chat Completion to generate feedback (Legacy sync).
        """
        prompt = (
            f"Write a brief (2-3 sentences), constructive, encouraging feedback note for a student who scored "
            f"{awarded_marks} out of {maximum_marks} on a question.\n"
            f"Student's Answer: {student_answer}\n"
            f"Reference Answer: {reference_answer}\n"
            f"Provide the feedback directly without prefixing."
        )

        messages = [
            {"role": "user", "content": prompt}
        ]

        payload = {
            "model": settings.LLM_MODEL,
            "messages": messages,
            "temperature": 0.5
        }

        try:
            api_response = self._call_api_with_retry(payload)
            return api_response["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Error generating feedback via API: %s. Using default fallback feedback.", str(e))
            ratio = awarded_marks / maximum_marks if maximum_marks > 0 else 0.0
            if ratio >= 0.8:
                return "Well done! The response fulfills the key aspects of the question."
            elif ratio >= 0.5:
                return "The response outlines the main ideas but lacks keyword details or completeness."
            else:
                return "Please review the reference response and check for keyword details."
