import time
import json
import logging
import httpx
from typing import Dict, Any, List
from app.providers.base_llm_provider import ILLMProvider
from app.models.evaluation_models import EvaluationCriteria
from app.services.prompt_builder import PromptBuilder
from app.config import settings

logger = logging.getLogger("app.providers.azure_llm_provider")

class AzureOpenAIProviderError(Exception):
    """Custom exception raised when Azure OpenAI API interactions fail."""
    pass

class AzureLLMProvider(ILLMProvider):
    """
    LLM provider using Azure OpenAI Service Chat Completion API to perform qualitative answer evaluations.
    """

    def __init__(self) -> None:
        self.endpoint = settings.AZURE_OPENAI_ENDPOINT
        self.api_key = settings.AZURE_OPENAI_API_KEY
        self.deployment = settings.AZURE_OPENAI_DEPLOYMENT
        self.api_version = settings.AZURE_OPENAI_API_VERSION
        self.timeout = settings.LLM_TIMEOUT
        self.max_retries = settings.LLM_MAX_RETRIES

        if not self.endpoint:
            raise AzureOpenAIProviderError(
                "Azure OpenAI Endpoint is missing. Set AZURE_OPENAI_ENDPOINT environment variable."
            )
        if not self.api_key:
            raise AzureOpenAIProviderError(
                "Azure OpenAI API key is missing. Set AZURE_OPENAI_API_KEY environment variable."
            )
        if not self.deployment:
            raise AzureOpenAIProviderError(
                "Azure OpenAI Deployment Name is missing. Set AZURE_OPENAI_DEPLOYMENT environment variable."
            )

        # Format Chat Completion URL for Azure OpenAI
        base = self.endpoint.rstrip("/")
        self.api_url = f"{base}/openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"

    def _call_api_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes HTTP calls with Azure authentication, Client retries and exponential backoff.
        """
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        last_exception = None
        current_delay = 1.0

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info("Calling Azure OpenAI API (Attempt %d/%d) on deployment: %s", attempt, self.max_retries, self.deployment)
                response = httpx.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout
                )
                
                # Check status code
                if response.status_code == 200:
                    return response.json()
                
                logger.warning("Azure OpenAI API returned HTTP %d: %s", response.status_code, response.text)
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt == self.max_retries:
                        raise AzureOpenAIProviderError(
                            f"Azure OpenAI API call failed after max retries. HTTP Status: {response.status_code}, Response: {response.text}"
                        )
                    time.sleep(current_delay)
                    current_delay *= 2.0
                    continue
                else:
                    raise AzureOpenAIProviderError(f"Azure OpenAI API request failed (HTTP {response.status_code}): {response.text}")
                    
            except httpx.RequestError as e:
                logger.warning("Network connection failure during Azure call: %s", str(e))
                last_exception = e
                if attempt == self.max_retries:
                    raise AzureOpenAIProviderError(f"Azure OpenAI API network failure: {str(e)}") from e
                time.sleep(current_delay)
                current_delay *= 2.0
                
        raise AzureOpenAIProviderError("Azure OpenAI API call failed due to an unexpected loop completion.")

    def evaluate_answer(
        self,
        question: str,
        student_answer: str,
        reference_answer: str,
        criteria: EvaluationCriteria,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluates the student answer using Azure OpenAI.
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

        payload = {
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
            logger.error("Failed to parse structured JSON from Azure response: %s. Response content: %s", str(e), api_response)
            raise AzureOpenAIProviderError(f"Failed to parse structured response from Azure LLM: {str(e)}") from e

        # Extract and validate fields
        awarded_marks = parsed_data.get("awarded_marks")
        reasoning = parsed_data.get("reasoning", "No LLM reasoning provided.")
        feedback = parsed_data.get("feedback", "No LLM feedback provided.")
        strengths = parsed_data.get("strengths", [])
        improvements = parsed_data.get("improvements", [])

        # Validate types
        try:
            awarded_marks = float(awarded_marks)
        except (TypeError, ValueError):
            logger.warning("Invalid marks returned by Azure LLM: %s. Defaulting to 0.0", awarded_marks)
            awarded_marks = 0.0

        # Cap marks between 0.0 and criteria_maximum_marks
        awarded_marks = max(0.0, min(criteria.maximum_marks, awarded_marks))

        # Format lists
        if not isinstance(strengths, list):
            strengths = [str(strengths)] if strengths else []
        if not isinstance(improvements, list):
            improvements = [str(improvements)] if improvements else []

        # Token usage tracking
        usage = api_response.get("usage", {})

        return {
            "awarded_marks": awarded_marks,
            "reasoning": reasoning,
            "feedback": feedback,
            "strengths": [str(s) for s in strengths],
            "improvements": [str(i) for i in improvements],
            "provider_metadata": {
                "provider": "azure",
                "model": settings.LLM_MODEL,
                "deployment": self.deployment,
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
        Queries Azure OpenAI Chat Completion to generate a paragraph of student feedback.
        """
        prompt = (
            f"Write a brief (2-3 sentences), constructive feedback note for a student who scored "
            f"{awarded_marks} out of {maximum_marks} on a question.\n"
            f"Student's Answer: {student_answer}\n"
            f"Reference Answer: {reference_answer}\n"
            f"Provide the feedback directly without prefixing."
        )

        messages = [
            {"role": "user", "content": prompt}
        ]

        payload = {
            "messages": messages,
            "temperature": 0.5
        }

        try:
            api_response = self._call_api_with_retry(payload)
            return api_response["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Error generating feedback via Azure API: %s. Using default fallback feedback.", str(e))
            ratio = awarded_marks / maximum_marks if maximum_marks > 0 else 0.0
            if ratio >= 0.8:
                return "Well done! The response fulfills the key aspects of the question."
            elif ratio >= 0.5:
                return "The response outlines the main ideas but lacks keyword details or completeness."
            else:
                return "Please review the reference response and check for keyword details."
