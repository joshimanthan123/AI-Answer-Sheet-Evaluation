import json
import re
import logging
from pydantic import ValidationError
from app.models.evaluation_llm_models import LLMEvaluationResponse
from app.core.exceptions import EvaluationResponseParseError, EvaluationResponseValidationError

logger = logging.getLogger("app.services.evaluation_response_parser")

class EvaluationResponseParser:
    """
    Parser service to extract and format structural JSON evaluation payloads from raw LLM responses.
    """

    @staticmethod
    def parse_response(raw_content: str) -> LLMEvaluationResponse:
        """
        Parses a raw string from LLM, strips markdown code fences if present,
        extracts valid JSON structure, and maps to LLMEvaluationResponse.
        """
        if not raw_content or not raw_content.strip():
            raise EvaluationResponseParseError("Empty or blank LLM response received.")

        cleaned = raw_content.strip()

        # Regular expression to extract JSON from markdown code fences if wrapped
        # e.g., ```json ... ``` or ``` ... ```
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
        if fence_match:
            cleaned = fence_match.group(1).strip()

        # Try to locate the JSON block using matching curly braces if there's surrounding text
        if not (cleaned.startswith("{") and cleaned.endswith("}")):
            json_curly_match = re.search(r"(\{[\s\S]*\})", cleaned)
            if json_curly_match:
                cleaned = json_curly_match.group(1).strip()

        try:
            parsed_json = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error("JSON parsing failed. Raw: %r, Cleaned: %r, Error: %s", raw_content, cleaned, str(e))
            raise EvaluationResponseParseError(f"Failed to parse LLM response as JSON: {str(e)}") from e

        if not isinstance(parsed_json, dict):
            raise EvaluationResponseParseError("LLM response must be a JSON object (dict). Received list or primitive.")

        try:
            # Validate JSON against LLMEvaluationResponse schema
            validated = LLMEvaluationResponse(**parsed_json)
            return validated
        except ValidationError as e:
            logger.error("Validation failed for LLM response JSON: %s. Data: %r", str(e), parsed_json)
            raise EvaluationResponseValidationError(f"Evaluation response validation failure: {str(e)}") from e
