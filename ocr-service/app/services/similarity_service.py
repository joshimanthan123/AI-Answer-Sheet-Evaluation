import difflib
from typing import Set
from app.services.keyword_service import KeywordService

class SimilarityService:
    """
    Independent service that handles calculating semantic/textual similarity
    between student answers and reference answers. Uses robust string-distance
    algorithms and token overlap metrics to ensure LLM-provider-independent consistency.
    """

    @classmethod
    def normalize_text(cls, text: str) -> str:
        """
        Uses KeywordService normalization to prepare text.
        """
        return KeywordService.clean_text(text)

    @classmethod
    def calculate_jaccard_similarity(cls, text1: str, text2: str) -> float:
        """
        Calculates Jaccard similarity between two sets of tokens.
        """
        tokens1: Set[str] = KeywordService.get_tokens(text1)
        tokens2: Set[str] = KeywordService.get_tokens(text2)

        if not tokens1 and not tokens2:
            return 1.0
        if not tokens1 or not tokens2:
            return 0.0

        intersection = tokens1.intersection(tokens2)
        union = tokens1.union(tokens2)
        return len(intersection) / len(union)

    @classmethod
    def calculate_sequence_similarity(cls, text1: str, text2: str) -> float:
        """
        Calculates character-sequence similarity using SequenceMatcher.
        """
        clean1 = cls.normalize_text(text1)
        clean2 = cls.normalize_text(text2)

        if not clean1 and not clean2:
            return 1.0
        if not clean1 or not clean2:
            return 0.0

        return difflib.SequenceMatcher(None, clean1, clean2).ratio()

    @classmethod
    def compute_similarity(cls, student_answer: str, reference_answer: str) -> float:
        """
        Computes a combined text similarity score [0.0 - 1.0] by weighting
        SequenceMatcher ratio (sequence flow) and Jaccard similarity (token presence).
        
        Args:
            student_answer: Transcribed student answer.
            reference_answer: Reference answer key text.
            
        Returns:
            float: Comprehensive textual similarity score between 0.0 and 1.0.
        """
        if not student_answer or not student_answer.strip():
            return 0.0
        if not reference_answer or not reference_answer.strip():
            return 0.0

        # Weighted combination: 50% sequence flow, 50% token presence (Jaccard)
        seq_sim = cls.calculate_sequence_similarity(student_answer, reference_answer)
        jac_sim = cls.calculate_jaccard_similarity(student_answer, reference_answer)

        combined = 0.5 * seq_sim + 0.5 * jac_sim
        return round(combined, 4)

    @classmethod
    def compute_completeness(cls, student_answer: str, reference_answer: str) -> float:
        """
        Computes completeness score representing length proportion (up to 1.0).
        """
        if not student_answer or not student_answer.strip():
            return 0.0
        if not reference_answer or not reference_answer.strip():
            return 1.0

        words_stud = len(student_answer.split())
        words_ref = len(reference_answer.split())

        if words_ref == 0:
            return 1.0
            
        ratio = words_stud / words_ref
        # Cap at 1.0 to prevent rewarding rambling/overly long responses excessively
        return round(min(1.0, ratio), 4)
