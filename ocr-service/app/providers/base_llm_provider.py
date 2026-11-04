from abc import ABC, abstractmethod
from typing import Dict, Any, List
from app.models.evaluation_models import EvaluationCriteria

class ILLMProvider(ABC):
    """
    Abstract Base Class (Interface) for downstream AI Evaluation LLM providers.
    Ensures decoupled model routing for qualitative evaluation.
    """

    @abstractmethod
    def evaluate_answer(
        self,
        question: str,
        student_answer: str,
        reference_answer: str,
        criteria: EvaluationCriteria,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """
        Performs qualitative evaluation on the student answer using an LLM model.
        
        Args:
            question: Question prompt text.
            student_answer: Student's handwritten answer text.
            reference_answer: Reference model answer key.
            criteria: EvaluationCriteria object storing mark bounds/weights.
            keywords: Expected keywords list.
            
        Returns:
            Dict[str, Any]: Standard evaluation payload containing:
                "awarded_marks": float
                "reasoning": str
                "feedback": str
                "strengths": List[str]
                "improvements": List[str]
                "provider_metadata": Dict[str, Any]
        """
        pass

    @abstractmethod
    def generate_feedback(
        self,
        student_answer: str,
        reference_answer: str,
        awarded_marks: float,
        maximum_marks: float
    ) -> str:
        """
        Generates overall student-focused constructive feedback.
        """
        pass
