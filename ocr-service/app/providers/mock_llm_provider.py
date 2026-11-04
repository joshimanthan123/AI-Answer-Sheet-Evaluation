import time
import random
from typing import Dict, Any, List
from app.providers.base_llm_provider import ILLMProvider
from app.models.evaluation_models import EvaluationCriteria
from app.services.similarity_service import SimilarityService
from app.services.keyword_service import KeywordService

class MockLLMProvider(ILLMProvider):
    """
    Offline Mock LLM provider that simulates LLM processing latency and returns
    deterministic, repeatable scoring, reasoning, and constructive feedback.
    """

    def evaluate_answer(
        self,
        question: str,
        student_answer: str,
        reference_answer: str,
        criteria: EvaluationCriteria,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """
        Deterministically evaluates student answers offline.
        """
        # Simulate network latency
        start_time = time.time()
        delay = random.uniform(0.05, 0.15)
        time.sleep(delay)

        # Handle empty/missing answers immediately
        if not student_answer or not student_answer.strip():
            return {
                "awarded_marks": 0.0,
                "reasoning": "Student answer is empty or missing.",
                "feedback": "No answer was provided for this question.",
                "strengths": [],
                "improvements": ["Please attempt all questions."],
                "provider_metadata": {
                    "provider": "mock",
                    "model": "mock-evaluator",
                    "latency": round(time.time() - start_time, 4),
                    "cached": False
                }
            }

        # Calculate scores using services to ensure deterministic outputs
        similarity = SimilarityService.compute_similarity(student_answer, reference_answer)
        kw_score = KeywordService.evaluate_keywords(student_answer, keywords)
        completeness = SimilarityService.compute_completeness(student_answer, reference_answer)

        # Weighted score: keyword_weight * kw_score + semantic_weight * similarity + completeness_weight * completeness
        # If total weight is not 1.0, normalize it
        total_weight = criteria.keyword_weight + criteria.semantic_weight + criteria.completeness_weight
        w_kw = criteria.keyword_weight / total_weight if total_weight > 0 else 0.33
        w_sem = criteria.semantic_weight / total_weight if total_weight > 0 else 0.33
        w_comp = criteria.completeness_weight / total_weight if total_weight > 0 else 0.34

        combined_ratio = (w_kw * kw_score) + (w_sem * similarity) + (w_comp * completeness)
        awarded_marks = round(criteria.maximum_marks * combined_ratio, 2)

        # Cap it
        awarded_marks = max(0.0, min(criteria.maximum_marks, awarded_marks))

        # Strengths and improvements selection based on similarity thresholds
        strengths = []
        improvements = []

        if similarity > 0.85:
            strengths.append("Demonstrates excellent conceptual understanding.")
            strengths.append("Highly aligned with the key reference response.")
        elif similarity > 0.60:
            strengths.append("Shows basic understanding of the question requirements.")
            improvements.append("Refine definitions and ensure all core aspects are detailed.")
        else:
            strengths.append("Attempted the question.")
            improvements.append("Lacks alignment with reference answer. Pay attention to key terms.")

        if kw_score > 0.80:
            strengths.append("Correctly utilizes expected technical keywords.")
        elif len(keywords) > 0 and kw_score < 0.40:
            improvements.append(f"Incorporate missing key concepts: {', '.join(keywords[:3])}")

        reasoning = (
            f"Evaluated marks programmatically: Text similarity is {similarity:.2%}, "
            f"expected keyword match is {kw_score:.2%}, and completeness ratio is {completeness:.2%}."
        )

        feedback = (
            f"The answer presents a {'strong' if similarity > 0.8 else 'moderate' if similarity > 0.5 else 'weak'} "
            f"match to the expected key points. Awarded {awarded_marks} out of {criteria.maximum_marks} marks."
        )

        return {
            "awarded_marks": awarded_marks,
            "reasoning": reasoning,
            "feedback": feedback,
            "strengths": strengths,
            "improvements": improvements,
            "provider_metadata": {
                "provider": "mock",
                "model": "mock-evaluator",
                "latency": round(time.time() - start_time, 4),
                "cached": False
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
        Generates general offline feedback.
        """
        ratio = awarded_marks / maximum_marks if maximum_marks > 0 else 0.0
        if ratio >= 0.8:
            return "Excellent submission. The response covers nearly all key components accurately."
        elif ratio >= 0.5:
            return "Passing submission. The response captures the core concepts but lacks elaboration or specific keyword detail."
        else:
            return "Needs significant improvement. The response is either too brief, incorrect, or misses major expected terms."
