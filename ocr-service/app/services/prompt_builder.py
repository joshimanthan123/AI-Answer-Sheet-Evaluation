import os
import logging
from pathlib import Path
from typing import List
from app.models.evaluation_models import EvaluationCriteria

logger = logging.getLogger("app.services.prompt_builder")

# Base directory for prompt files
APP_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = APP_DIR / "prompts"
PROMPT_FILE = PROMPTS_DIR / "evaluation_prompt.txt"

DEFAULT_TEMPLATE = """You are an expert academic evaluator. Your task is to evaluate a student's answer against a reference answer.
Evaluate the answer based on correctness, completeness, and matching key components/concepts.

Context:
- Question: {question}
- Maximum Marks: {maximum_marks}
- Reference Answer: {reference_answer}
- Student Answer: {student_answer}
- Evaluation Criteria Detail:
  * Keyword Weight: {keyword_weight}
  * Semantic Weight: {semantic_weight}
  * Completeness Weight: {completeness_weight}
  * Passing Marks: {passing_marks}

Instructions:
1. Provide qualitative feedback explaining how well the student addressed the request.
2. Estimate the awarded marks out of {maximum_marks} based on correctness and the evaluation criteria. Be fair, objective, and support partial marking. If the student answer is completely incorrect or empty, award 0.0 marks.
3. List specific key strengths of the student's answer.
4. List areas of improvement or weaknesses.
5. Provide clear reasoning explaining how the score was calculated.
6. Return a valid JSON object only. Do NOT wrap the JSON in markdown code blocks like ```json ... ``` or include any text outside the JSON.

Expected JSON format:
{{
  "awarded_marks": <float>,
  "reasoning": "Detailed justification of marks",
  "feedback": "Overall constructive feedback",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"]
}}"""

class PromptBuilder:
    """
    Builds structured evaluation prompts for LLM providers.
    Caches prompt templates from external file and falls back to default constants.
    """
    _template_cache: str | None = None

    @classmethod
    def get_template(cls) -> str:
        """
        Reads, caches, and returns the evaluation prompt template from the file system.
        """
        if cls._template_cache is not None:
            return cls._template_cache

        if PROMPT_FILE.exists():
            try:
                with open(PROMPT_FILE, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                if "${question}" in content or "${model_answer}" in content:
                    logger.info("evaluation_prompt.txt uses string.Template. PromptBuilder falling back to default format.")
                else:
                    cls._template_cache = content
                    logger.info("Loaded evaluation prompt template from: %s", PROMPT_FILE)
                    return cls._template_cache
            except Exception as e:
                logger.error("Error reading prompt template file: %s. Using default.", str(e))
        else:
            logger.warning("Prompt template path not found: %s. Using default template.", PROMPT_FILE)

        cls._template_cache = DEFAULT_TEMPLATE
        return cls._template_cache


    @classmethod
    def build_user_prompt(
        cls,
        question: str,
        student_answer: str,
        reference_answer: str,
        criteria: EvaluationCriteria,
        keywords: List[str]
    ) -> str:
        """
        Formats the evaluation prompt with target answer details and criteria.
        """
        template = cls.get_template()
        
        # Format list list of keywords
        keyword_str = ", ".join(keywords) if keywords else "None specified"
        
        return template.format(
            question=question,
            student_answer=student_answer or "[No answer provided]",
            reference_answer=reference_answer,
            keyword_weight=criteria.keyword_weight,
            semantic_weight=criteria.semantic_weight,
            completeness_weight=criteria.completeness_weight,
            passing_marks=criteria.passing_marks,
            maximum_marks=criteria.maximum_marks,
            keywords=keyword_str
        )
