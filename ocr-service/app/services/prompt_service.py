import os
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Any

from app.config import settings
from app.core.exceptions import (
    PromptTemplateNotFound,
    PromptTemplateInvalid,
    PromptPlaceholderMissing,
    PromptTooLarge,
)
from app.models.prompt_models import (
    PromptType,
    EvaluationPromptRequest,
    KeywordPromptRequest,
    FeedbackPromptRequest,
    PromptResponse,
)

logger = logging.getLogger("app.services.prompt_service")

# Map of PromptType to its exact required placeholders set
EXPECTED_PLACEHOLDERS = {
    PromptType.SYSTEM: set(),
    PromptType.EVALUATION: {
        "question",
        "maximum_marks",
        "model_answer",
        "keywords",
        "rubric",
        "student_answer",
    },
    PromptType.KEYWORD: {"model_answer"},
    PromptType.FEEDBACK: {"marks", "strengths", "missing_points"},
}

# Versioning matching
TEMPLATE_VERSIONS = {
    PromptType.SYSTEM: "1.0",
    PromptType.EVALUATION: "1.0",
    PromptType.KEYWORD: "1.0",
    PromptType.FEEDBACK: "1.0",
}


class PromptService:
    """
    Template engine orchestrating system prompts and user payloads compilation.
    Loads templates dynamically, supports localization, validates placeholders, and caches compiled states.
    """

    def __init__(self) -> None:
        self._template_cache: dict[PromptType, Template] = {}
        self._template_mtimes: dict[PromptType, float] = {}
        self._template_paths: dict[PromptType, Path] = {}
        self._load_templates()

    def _get_template_path(self, prompt_type: PromptType, lang: str) -> Path:
        """
        Determines the localized file system path for a template type.
        Checks for {name}_prompt_{lang}.txt first, then falls back to {name}_prompt.txt.
        """
        base_dir = Path(settings.PROMPT_TEMPLATE_DIR)
        name = prompt_type.value

        # Match exact pattern: e.g. evaluation_prompt_en.txt
        localized_filename = f"{name}_prompt_{lang}.txt"
        localized_path = base_dir / localized_filename

        if localized_path.exists():
            return localized_path

        # Fallback file: e.g. evaluation_prompt.txt
        fallback_filename = f"{name}_prompt.txt"
        fallback_path = base_dir / fallback_filename

        return fallback_path

    def _extract_placeholders(self, template_str: str) -> set[str]:
        """
        Parses actual template string identifiers utilizing string.Template definitions.
        """
        placeholders = set()
        for match in Template.pattern.finditer(template_str):
            gp = match.groupdict()
            name = gp.get("braced") or gp.get("named")
            if name:
                placeholders.add(name)
        return placeholders

    def _validate_template(self, prompt_type: PromptType, template_str: str) -> None:
        """
        Enforces strict structural rules:
        - Must contain all required placeholders.
        - Must not contain unknown placeholders.
        """
        actual = self._extract_placeholders(template_str)
        expected = EXPECTED_PLACEHOLDERS[prompt_type]

        missing = expected - actual
        unknown = actual - expected

        if missing:
            logger.error(
                "Template validation error for type '%s': Missing required placeholders: %s",
                prompt_type.value,
                missing,
            )
            raise PromptTemplateInvalid(
                f"Prompt template invalid: Missing placeholders: {', '.join(missing)}"
            )

        if unknown:
            logger.error(
                "Template validation error for type '%s': Unknown placeholders detected: %s",
                prompt_type.value,
                unknown,
            )
            raise PromptTemplateInvalid(
                f"Prompt template invalid: Unknown placeholders: {', '.join(unknown)}"
            )

    def _load_template_file(self, prompt_type: PromptType) -> tuple[Template, float, Path]:
        """
        Performs disk reading of the template file under configured language parameters.
        Raises PromptTemplateNotFound for missing files. Securely conceals system paths.
        """
        lang = settings.PROMPT_LANGUAGE
        target_path = self._get_template_path(prompt_type, lang)

        if not target_path.exists():
            logger.error("Template load failed: path for type '%s' is missing.", prompt_type.value)
            raise PromptTemplateNotFound(
                f"Template not found: Could not find template file for type '{prompt_type.value}'."
            )

        try:
            mtime = target_path.stat().st_mtime
            with open(target_path, "r", encoding="utf-8") as f:
                content = f.read()

            self._validate_template(prompt_type, content)
            
            logger.info(
                "Loaded template - Template=%s - Language=%s - Version=%s - Size=%d bytes",
                prompt_type.value,
                lang,
                TEMPLATE_VERSIONS[prompt_type],
                len(content),
            )
            return Template(content), mtime, target_path

        except PromptTemplateInvalid:
            raise
        except Exception as e:
            logger.exception("Failed to read template file for type '%s'.", prompt_type.value)
            raise PromptTemplateInvalid(f"Prompt template invalid: File read failure.")

    def _load_templates(self) -> None:
        """
        Dynamic loader performing boot sequence checks on required templates.
        """
        logger.info("Initializing and parsing prompt templates...")
        for pt in PromptType:
            template, mtime, path = self._load_template_file(pt)
            self._template_cache[pt] = template
            self._template_mtimes[pt] = mtime
            self._template_paths[pt] = path

    def _check_hot_reload(self, prompt_type: PromptType) -> None:
        """
        Auto hot-reloads templates in production environments if files show system mtime edits.
        """
        path = self._template_paths.get(prompt_type)
        if not path or not path.exists():
            # Trigger fresh path check
            fresh_path = self._get_template_path(prompt_type, settings.PROMPT_LANGUAGE)
            if not fresh_path.exists():
                return
            path = fresh_path

        try:
            current_mtime = path.stat().st_mtime
            cached_mtime = self._template_mtimes.get(prompt_type, 0.0)

            if current_mtime > cached_mtime:
                logger.info("Hot-reload triggered: Template file '%s' has modified timestamps.", path.name)
                template, mtime, _ = self._load_template_file(prompt_type)
                self._template_cache[prompt_type] = template
                self._template_mtimes[prompt_type] = mtime
        except Exception:
            logger.warning("/app/prompts auto hot-reload parsing failed. Retaining cached model.")

    def _render_template(self, prompt_type: PromptType, variables: dict[str, Any]) -> str:
        """
        Renders template using dictionary replacement.
        Enforces token boundary validations and placeholder completeness.
        """
        self._check_hot_reload(prompt_type)

        template = self._template_cache.get(prompt_type)
        if not template:
            raise PromptTemplateNotFound(f"Template not found: Type '{prompt_type.value}' is absent.")

        # Ensure all required placeholders are present in variables mapping.
        required = EXPECTED_PLACEHOLDERS[prompt_type]
        for name in required:
            if name not in variables:
                logger.error("Render failed: expected parameter '%s' is missing.", name)
                raise PromptPlaceholderMissing(
                    f"Prompt placeholder missing: Required input '{name}' has not been provided."
                )

        try:
            prompt_content = template.substitute(variables)
        except Exception as e:
            logger.error("Template rendering replacement failed: %s", str(e))
            raise PromptPlaceholderMissing(f"Prompt placeholder missing: substitution error.")

        # Length validation limits
        max_chars = settings.MAX_PROMPT_TOKENS * 4
        if len(prompt_content) > max_chars:
            logger.error(
                "Render failed: compiled prompt character length (%d) exceeds limit (%d).",
                len(prompt_content),
                max_chars,
            )
            raise PromptTooLarge(
                f"Rendered prompt size is too large: character length exceeds maximum permissible limit."
            )

        return prompt_content

    def build_evaluation_prompt(self, request: EvaluationPromptRequest) -> PromptResponse:
        """
        Substitutes details into evaluation template.
        Formats keywords list and rubric values gracefully.
        """
        # Load system prompt
        self._check_hot_reload(PromptType.SYSTEM)
        system_tmpl = self._template_cache.get(PromptType.SYSTEM)
        system_str = system_tmpl.template if system_tmpl else ""

        # Normalize evaluation inputs
        kw_str = ", ".join(request.keywords).strip() if request.keywords else "None specified"
        rubric_str = request.rubric.strip() if request.rubric and request.rubric.strip() else "None provided"
        student_ans = request.student_answer.strip() if request.student_answer.strip() else "[No answer provided]"

        vars_map = {
            "question": request.question.strip(),
            "maximum_marks": str(request.maximum_marks),
            "model_answer": request.model_answer.strip(),
            "keywords": kw_str,
            "rubric": rubric_str,
            "student_answer": student_ans,
        }

        rendered = self._render_template(PromptType.EVALUATION, vars_map)

        meta = {
            "template_name": PromptType.EVALUATION.value,
            "language": settings.PROMPT_LANGUAGE,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "placeholder_count": len(EXPECTED_PLACEHOLDERS[PromptType.EVALUATION]),
            "template_version": TEMPLATE_VERSIONS[PromptType.EVALUATION],
        }

        llm_params = {
            "temperature": 0.0,
            "max_tokens": settings.PROMPT_MAX_OUTPUT_TOKENS,
            "response_format": "json" if settings.PROMPT_STRICT_JSON else "text",
        }

        return PromptResponse(
            system_prompt=system_str,
            prompt=rendered,
            metadata=meta,
            llm_parameters=llm_params,
        )

    def build_keyword_prompt(self, request: KeywordPromptRequest) -> PromptResponse:
        """
        Compiles model answer details into keyword extraction template.
        """
        # Load system prompt
        self._check_hot_reload(PromptType.SYSTEM)
        system_tmpl = self._template_cache.get(PromptType.SYSTEM)
        system_str = system_tmpl.template if system_tmpl else ""

        vars_map = {
            "model_answer": request.model_answer.strip(),
        }

        rendered = self._render_template(PromptType.KEYWORD, vars_map)

        meta = {
            "template_name": PromptType.KEYWORD.value,
            "language": settings.PROMPT_LANGUAGE,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "placeholder_count": len(EXPECTED_PLACEHOLDERS[PromptType.KEYWORD]),
            "template_version": TEMPLATE_VERSIONS[PromptType.KEYWORD],
        }

        llm_params = {
            "temperature": 0.0,
            "max_tokens": settings.PROMPT_MAX_OUTPUT_TOKENS,
            "response_format": "json" if settings.PROMPT_STRICT_JSON else "text",
        }

        return PromptResponse(
            system_prompt=system_str,
            prompt=rendered,
            metadata=meta,
            llm_parameters=llm_params,
        )

    def build_feedback_prompt(self, request: FeedbackPromptRequest) -> PromptResponse:
        """
        Compiles scoring and response outputs into feedback rendering template.
        """
        # Load system prompt
        self._check_hot_reload(PromptType.SYSTEM)
        system_tmpl = self._template_cache.get(PromptType.SYSTEM)
        system_str = system_tmpl.template if system_tmpl else ""

        # Format lists
        strengths_str = ", ".join(request.strengths) if request.strengths else "None identified"
        missing_str = ", ".join(request.missing_points) if request.missing_points else "None identified"

        vars_map = {
            "marks": str(request.marks),
            "strengths": strengths_str,
            "missing_points": missing_str,
        }

        rendered = self._render_template(PromptType.FEEDBACK, vars_map)

        meta = {
            "template_name": PromptType.FEEDBACK.value,
            "language": settings.PROMPT_LANGUAGE,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "placeholder_count": len(EXPECTED_PLACEHOLDERS[PromptType.FEEDBACK]),
            "template_version": TEMPLATE_VERSIONS[PromptType.FEEDBACK],
        }

        llm_params = {
            "temperature": 0.3, # slightly higher for constructive phrasing details
            "max_tokens": settings.PROMPT_MAX_OUTPUT_TOKENS,
            "response_format": "text",
        }

        return PromptResponse(
            system_prompt=system_str,
            prompt=rendered,
            metadata=meta,
            llm_parameters=llm_params,
        )

    def reload_templates(self) -> None:
        """
        Exposes template cache flush operation.
        Verifies and saves fresh versions from templates directory.
        """
        logger.info("Executing global prompt template reload sequence...")
        self._template_cache.clear()
        self._template_mtimes.clear()
        self._template_paths.clear()
        self._load_templates()
        logger.info("Prompt templates reload completed successfully. Caches refreshed.")
