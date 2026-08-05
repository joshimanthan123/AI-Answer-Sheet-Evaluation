import re
from typing import List, Set

# Standard small helper set of English stop words to filter out
STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", 
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", 
    "by", "can", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", 
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", 
    "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "me", "more", 
    "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", 
    "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", 
    "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", 
    "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", 
    "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", 
    "with", "you", "your", "yours", "yourself", "yourselves"
}

class KeywordService:
    """
    Service responsible for matching expected key terms and concepts within
    student answers to compute a keyword match score.
    """

    @staticmethod
    def clean_text(text: str) -> str:
        """
        Normalizes text by lowercasing, stripping punctuation/special chars, and trimming.
        """
        if not text:
            return ""
        # Lowercase
        text = text.lower()
        # Remove punctuation, keep alphanumeric and spaces
        text = re.sub(r"[^\w\s-]", "", text)
        # Collapse multiple spaces
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def get_tokens(text: str) -> Set[str]:
        """
        Tokenizes text and removes standard stop words.
        """
        cleaned = KeywordService.clean_text(text)
        tokens = cleaned.split()
        return {token for token in tokens if token not in STOP_WORDS}

    @classmethod
    def evaluate_keywords(cls, student_answer: str, expected_keywords: List[str]) -> float:
        """
        Calculates the ratio of matched keywords in the student's answer.
        
        Args:
            student_answer: Transcription of the student's answer.
            expected_keywords: List of key phrases or words expected.
            
        Returns:
            float: Score between 0.0 (no match) and 1.0 (all matched).
        """
        if not expected_keywords:
            return 1.0  # if no keywords are expected, default to full marks for keywords
            
        if not student_answer or not student_answer.strip():
            return 0.0

        student_clean = cls.clean_text(student_answer)
        student_tokens = cls.get_tokens(student_answer)

        matched_count = 0
        for kw in expected_keywords:
            kw_clean = cls.clean_text(kw)
            if not kw_clean:
                continue

            # Multi-word phrase check (e.g. "machine learning") - check as substring in normalized text
            if len(kw_clean.split()) > 1:
                if kw_clean in student_clean:
                    matched_count += 1
                else:
                    # Fallback synonym/fuzzy support: check if all tokens of the phrase appear
                    kw_tokens = set(kw_clean.split())
                    if kw_tokens.issubset(student_tokens):
                        matched_count += 1
            else:
                # Single word keyword check: must exist in set of tokens (avoids sub-word matches like 'learning' matching 'learn')
                if kw_clean in student_tokens:
                    matched_count += 1
                # Fallback: substring match just in case
                elif kw_clean in student_clean:
                    matched_count += 1

        return round(matched_count / len(expected_keywords), 4)
