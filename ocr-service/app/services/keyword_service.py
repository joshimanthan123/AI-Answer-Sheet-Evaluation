import re
import logging
from typing import List

logger = logging.getLogger("app.services.keyword_service")

class KeywordService:
    """
    Keyword analyzer service which handles match and missing checks.
    Uses normalized phrase matching and safe boundary checks.
    """

    @staticmethod
    def _normalize_text(text: str) -> str:
        """
        Lowercases, strips, and normalizes consecutive whitespaces into a single space.
        """
        if not text:
            return ""
        return " ".join(text.lower().strip().split())

    @classmethod
    def _is_keyword_matched(cls, student_normalized: str, keyword: str) -> bool:
        """
        Checks if the keyword exists in normalized student text using non-alphanumeric boundaries.
        """
        kw_norm = cls._normalize_text(keyword)
        if not kw_norm:
            return False

        # Find all occurrences of kw_norm in student_normalized
        start = 0
        while True:
            pos = student_normalized.find(kw_norm, start)
            if pos == -1:
                break

            # Safe boundary checks:
            # Match is invalid if character before is alphanumeric,
            # or character after is alphanumeric.
            # (Allows punctuation like + in C++ or / in TCP/IP)
            char_before_ok = True
            if pos > 0:
                char_before = student_normalized[pos - 1]
                if char_before.isalnum():
                    char_before_ok = False

            char_after_ok = True
            end_pos = pos + len(kw_norm)
            if end_pos < len(student_normalized):
                char_after = student_normalized[end_pos]
                if char_after.isalnum():
                    char_after_ok = False

            if char_before_ok and char_after_ok:
                return True

            start = pos + 1

        return False

    @classmethod
    def extract_matched_keywords(cls, student_answer: str, expected_keywords: List[str]) -> List[str]:
        """
        Returns expectation elements matched in student answer.
        Deduplicates results while preserving original keyword representation/casing.
        """
        if not expected_keywords:
            return []

        student_norm = cls._normalize_text(student_answer)
        matched = []
        seen = set()

        for kw in expected_keywords:
            if not kw:
                continue
            kw_norm = cls._normalize_text(kw)
            # Ensure we only check uniqueness by normalized representation
            if kw_norm not in seen:
                if cls._is_keyword_matched(student_norm, kw):
                    matched.append(kw)
                    seen.add(kw_norm)

        return matched

    @classmethod
    def extract_missing_keywords(cls, student_answer: str, expected_keywords: List[str]) -> List[str]:
        """
        Returns expectation elements missing from student answer.
        Deduplicates results while preserving original keyword representation/casing.
        """
        if not expected_keywords:
            return []

        student_norm = cls._normalize_text(student_answer)
        missing = []
        seen = set()

        for kw in expected_keywords:
            if not kw:
                continue
            kw_norm = cls._normalize_text(kw)
            if kw_norm not in seen:
                if not cls._is_keyword_matched(student_norm, kw):
                    missing.append(kw)
                    seen.add(kw_norm)

        return missing

    # =========================================================================
    # Legacy Support for Phase 3B AnswerEvaluationService compatibility
    # =========================================================================

    @classmethod
    def evaluate_keywords(cls, student_text: str, expected_keywords: List[str]) -> float:
        """
        Legacy keyword matching computation yielding a score between 0.0 and 1.0.
        """
        if not expected_keywords:
            return 1.0

        matched = cls.extract_matched_keywords(student_text, expected_keywords)
        # Deduplicated unique expected keyword set count:
        unique_expected = len(set(cls._normalize_text(k) for k in expected_keywords if k))
        if unique_expected == 0:
            return 1.0

        return round(len(matched) / unique_expected, 4)

    @classmethod
    def clean_text(cls, text: str) -> str:
        """
        Cleans text for similarity calculations. Lowercases, strips punctuation.
        """
        if not text:
            return ""
        cleaned = text.lower().strip()
        cleaned = re.sub(r'[\r\n\t]+', ' ', cleaned)
        cleaned = re.sub(r'[^\w\s]', '', cleaned)
        return " ".join(cleaned.split())

    @classmethod
    def get_tokens(cls, text: str) -> set[str]:
        """
        Splits cleaned text into tokens.
        """
        cleaned = cls.clean_text(text)
        return set(cleaned.split())
