import time
import logging
from typing import List, Dict, Any, Optional
from app.config import settings
from app.models.evaluation_models import EvaluationCriteria, EvaluatedAnswer, EvaluationResult
from app.providers.base_llm_provider import ILLMProvider
from app.services.keyword_service import KeywordService
from app.services.similarity_service import SimilarityService

logger = logging.getLogger("app.services.evaluation_service")

class AnswerEvaluationService:
    """
    Main orchestrator service that coordinates keyword overlap, semantic text similarity,
    and qualitative LLM evaluation to produce structured answer assessments.
    """

    @staticmethod
    def get_provider(provider_name: str) -> ILLMProvider:
        """
        Factory method to resolve and instantiate the requested LLM provider.
        """
        name = provider_name.lower().strip()
        if name == "mock":
            from app.providers.mock_llm_provider import MockLLMProvider
            return MockLLMProvider()
        elif name == "openai":
            from app.providers.openai_provider import OpenAIProvider
            return OpenAIProvider()
        elif name == "azure":
            from app.providers.azure_llm_provider import AzureLLMProvider
            return AzureLLMProvider()
        else:
            raise ValueError(f"Unsupported LLM provider: '{provider_name}'. Must be 'mock', 'openai', or 'azure'.")

    @classmethod
    def evaluate_student_answers(
        cls,
        exam_id: str,
        student_id: str,
        student_answers: List[Dict[str, Any]],
        reference_keys: Dict[str, Dict[str, Any]],
        criteria_map: Optional[Dict[str, EvaluationCriteria]] = None
    ) -> EvaluationResult:
        """
        Orchestrates full exam grading on student segmented OCR answers.
        
        Args:
            exam_id: Identifier for the exam.
            student_id: Identifier for the evaluated student.
            student_answers: List of OCR outputs:
                [{"question_number": "Q1", "student_answer": "...text...", "confidence": 0.94}]
            reference_keys: Answer keys:
                {"Q1": {"reference_answer": "...text...", "maximum_marks": 10.0, "keywords": ["ai", "logic"]}}
            criteria_map: Optional question-specific evaluation weights/rules mapping.
            
        Returns:
            EvaluationResult: Consolidated marks and feedback breakdown.
        """
        start_time = time.time()
        logger.info("Initializing AnswerEvaluationService for Exam %s, Student %s", exam_id, student_id)
        
        evaluated_answers: List[EvaluatedAnswer] = []
        warnings: List[str] = []
        status_flag = "SUCCESS"

        # Validate Provider Configuration
        try:
            provider = cls.get_provider(settings.LLM_PROVIDER)
        except Exception as e:
            logger.error("Provider initialization failed: %s", str(e))
            warnings.append(f"LLM Provider initialization failed: {str(e)}. Falling back to offline grading.")
            provider = cls.get_provider("mock")
            status_flag = "PARTIAL_SUCCESS"

        # Process each answer
        for sa in student_answers:
            q_num = sa.get("question_number")
            if not q_num:
                warnings.append("Found student answer with missing question_number. Skipping.")
                continue

            q_num = str(q_num).strip()
            student_text = sa.get("student_answer")
            ocr_confidence = sa.get("confidence", 1.0)
            
            # Check if reference key exists for this question
            ref_info = reference_keys.get(q_num)
            if not ref_info:
                warning_msg = f"No reference key found for question {q_num}. Skipping evaluation."
                logger.warning(warning_msg)
                warnings.append(warning_msg)
                status_flag = "PARTIAL_SUCCESS"
                continue

            # Load question credentials
            ref_answer = ref_info.get("reference_answer", "")
            maximum_marks = float(ref_info.get("maximum_marks", 0.0))
            keywords = ref_info.get("keywords", [])
            passing_marks = float(ref_info.get("passing_marks", maximum_marks * 0.40)) # Default 40% pass cutoff

            # Warn on invalid marks
            if maximum_marks <= 0:
                warning_msg = f"Question {q_num} configured with invalid maximum_marks (<=0). Setting to 0."
                logger.warning(warning_msg)
                warnings.append(warning_msg)
                maximum_marks = 0.0
                status_flag = "PARTIAL_SUCCESS"

            # Check OCR confidence threshold mapping
            if ocr_confidence < settings.SEGMENTATION_MIN_CONFIDENCE:
                warnings.append(f"OCR confidence for {q_num} ({ocr_confidence:.2f}) is below config limit ({settings.SEGMENTATION_MIN_CONFIDENCE:.2f}). Result may be inaccurate.")

            # Load/Build weights criteria
            criteria = None
            if criteria_map:
                criteria = criteria_map.get(q_num)
            
            if not criteria:
                # Build default criteria based on enabling flags
                kw_weight = 0.3 if settings.ENABLE_KEYWORD_SCORING and keywords else 0.0
                sem_weight = 0.4
                comp_weight = 0.3 if kw_weight > 0 else 0.6
                
                criteria = EvaluationCriteria(
                    maximum_marks=maximum_marks,
                    passing_marks=passing_marks,
                    keyword_weight=kw_weight,
                    semantic_weight=sem_weight,
                    completeness_weight=comp_weight
                )

            # Quantitative analysis (Independent of LLM)
            similarity = SimilarityService.compute_similarity(student_text, ref_answer)
            keyword_score = KeywordService.evaluate_keywords(student_text, keywords)
            completeness = SimilarityService.compute_completeness(student_text, ref_answer)

            # Check empty/missing student answers
            if not student_text or not student_text.strip():
                # Evaluated answer with absolute zero marks
                evaluated_answers.append(
                    EvaluatedAnswer(
                        question_number=q_num,
                        student_answer="",
                        reference_answer=ref_answer,
                        maximum_marks=maximum_marks,
                        awarded_marks=0.0,
                        semantic_similarity=0.0,
                        keyword_score=0.0,
                        completeness_score=0.0,
                        confidence=ocr_confidence,
                        feedback="No answer provided.",
                        reasoning="Student answer is completely blank.",
                        strengths=[],
                        improvements=["Ensure all exam questions are attempted."],
                        provider_metadata={"error": "Empty Student Answer"}
                    )
                )
                continue

            # Qualitative evaluation (Query active provider)
            llm_result = None
            try:
                llm_result = provider.evaluate_answer(
                    question=f"Evaluate student's answer for question number {q_num}",
                    student_answer=student_text,
                    reference_answer=ref_answer,
                    criteria=criteria,
                    keywords=keywords
                )
            except Exception as e:
                err_msg = f"LLM evaluation failed on question {q_num}: {str(e)}. Falling back to local grading."
                logger.error(err_msg)
                warnings.append(err_msg)
                status_flag = "PARTIAL_SUCCESS"

                # Fallback grading
                total_weight = criteria.keyword_weight + criteria.semantic_weight + criteria.completeness_weight
                w_kw = criteria.keyword_weight / total_weight if total_weight > 0 else 0.33
                w_sem = criteria.semantic_weight / total_weight if total_weight > 0 else 0.33
                w_comp = criteria.completeness_weight / total_weight if total_weight > 0 else 0.34

                ratio = (w_kw * keyword_score) + (w_sem * similarity) + (w_comp * completeness)
                awarded = round(criteria.maximum_marks * ratio, 2)
                if not settings.ENABLE_PARTIAL_MARKING:
                    awarded = criteria.maximum_marks if ratio >= settings.SIMILARITY_THRESHOLD else 0.0

                llm_result = {
                    "awarded_marks": awarded,
                    "reasoning": f"Algorithmic grading fallback due to LLM provider execution boundary: {str(e)}",
                    "feedback": f"Offline automated check completed. Match accuracy: {similarity:.2%}.",
                    "strengths": ["Attempted response matches structure/flow."],
                    "improvements": ["Review against answer key details."],
                    "provider_metadata": {"fallback": True, "error": str(e)}
                }

            # Enforce non-negativity and bounds validation
            final_marks = llm_result["awarded_marks"]
            final_marks = max(0.0, min(maximum_marks, final_marks))

            evaluated_answers.append(
                EvaluatedAnswer(
                    question_number=q_num,
                    student_answer=student_text,
                    reference_answer=ref_answer,
                    maximum_marks=maximum_marks,
                    awarded_marks=final_marks,
                    semantic_similarity=similarity,
                    keyword_score=keyword_score,
                    completeness_score=completeness,
                    confidence=ocr_confidence,
                    feedback=llm_result.get("feedback", ""),
                    reasoning=llm_result.get("reasoning", ""),
                    strengths=llm_result.get("strengths", []),
                    improvements=llm_result.get("improvements", []),
                    provider_metadata=llm_result.get("provider_metadata", {})
                )
            )

        # Aggregate overall exam outcomes
        total_awarded = sum(ea.awarded_marks for ea in evaluated_answers)
        total_maximum = sum(ea.maximum_marks for ea in evaluated_answers)
        percentage = (total_awarded / total_maximum * 100) if total_maximum > 0 else 0.0

        avg_similarity = sum(ea.semantic_similarity for ea in evaluated_answers) / len(evaluated_answers) if evaluated_answers else 0.0
        avg_kw_score = sum(ea.keyword_score for ea in evaluated_answers) / len(evaluated_answers) if evaluated_answers else 0.0

        # Construct overall structured feedback summary
        overall_feedback = ""
        if settings.ENABLE_FEEDBACK_GENERATION and evaluated_answers:
            overall_feedback = f"Exam evaluation complete. Student achieved {total_awarded:.2f}/{total_maximum:.2f} ({percentage:.2f}%). "
            if percentage >= 75.0:
                overall_feedback += "Outstanding performance showing deep understanding across modules."
            elif percentage >= 40.0:
                overall_feedback += "Satisfactory result. Conceptual understanding is present but requires revision on key terminology."
            else:
                overall_feedback += "Unsatisfactory. Extensive revision and guidance needed to cover fundamental requirements."

        # Compute duration metrics
        elapsed_time = round(time.time() - start_time, 4)

        if not evaluated_answers:
            status_flag = "FAILED"
            warnings.append("No answers were evaluated.")

        return EvaluationResult(
            exam_id=exam_id,
            student_id=student_id,
            evaluated_answers=evaluated_answers,
            total_marks=round(total_awarded, 2),
            maximum_marks=round(total_maximum, 2),
            percentage=round(percentage, 2),
            overall_feedback=overall_feedback,
            warnings=warnings,
            execution_time=elapsed_time,
            status=status_flag, # type: ignore
            average_similarity=round(avg_similarity, 4),
            average_keyword_score=round(avg_kw_score, 4),
            processing_provider=settings.LLM_PROVIDER,
            processing_model=settings.LLM_MODEL
        )
