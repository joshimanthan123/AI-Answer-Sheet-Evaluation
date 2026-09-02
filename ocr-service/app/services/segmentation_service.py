import time
import logging
import re
from typing import List, Union, Optional
from app.config import settings
from app.models.hwr_models import HWRResult, HWRLine
from app.models.segmentation_models import SegmentedAnswer, AnswerMetadata, SegmentationResult
from app.utils.question_detector import parse_question_number
from app.utils.confidence_utils import calculate_average_confidence, classify_confidence

logger = logging.getLogger("app.services.segmentation_service")


class AnswerSegmentationService:
    """
    Stateless high-level service to segment transcribed OCR documents into
    question-wise answers. Evaluates line-telemetry and raises programmatic warnings.
    """

    @staticmethod
    def extract_numeric_part(q_name: str) -> Optional[int]:
        """Utility to pull the first numeric digit from localized key tags."""
        match = re.search(r'\d+', q_name)
        return int(match.group(0)) if match else None

    @classmethod
    def segment_answers(
        cls, 
        hwr_input: Union[HWRResult, List[HWRResult]]
    ) -> SegmentationResult:
        """
        Segments a single page HWRResult or multi-page List[HWRResult] into question-based answer blocks.
        
        Args:
            hwr_input: Single or sequential list of OCR document page transcripts.
            
        Returns:
            SegmentationResult: Mapped answers and collection of diagnostic logs.
        """
        start_exec = time.time()
        logger.info("Initializing answer segmentation process...")
        
        # 1. Flatten all lines with page and indexing metadata
        flat_lines = []
        if isinstance(hwr_input, list):
            for page_idx, page_result in enumerate(hwr_input):
                page_num = page_idx + 1
                for line_idx, line in enumerate(page_result.lines):
                    flat_lines.append((line, page_num, line_idx + 1))
        else:
            for line_idx, line in enumerate(hwr_input.lines):
                flat_lines.append((line, 1, line_idx + 1))
                
        # 2. Iterate and split along discovered question boundaries
        answers_list: List[SegmentedAnswer] = []
        duplicate_questions: List[str] = []
        unknown_sections: List[str] = []
        warnings: List[str] = []
        
        current_question: Optional[str] = None
        current_normalized: Optional[str] = None
        current_original: Optional[str] = None
        current_start: int = 1
        current_lines: List[Tuple[HWRLine, int]] = [] # (line_obj, page)
        
        # Helper to finalize and push segments
        def finalize_active_segment(end_idx: int):
            nonlocal current_question, current_normalized, current_original, current_start, current_lines
            if not current_normalized:
                return
                
            # Filter non-empty textual lines to perform clean evaluations
            non_empty_runs = [l for l, p in current_lines if l.text.strip()]
            
            # Compute average confidence
            if not non_empty_runs:
                avg_confidence = 0.0
                answer_text = ""
                warnings.append(f"EMPTY_ANSWER: No content found for question {current_normalized}")
            else:
                confs = [l.confidence for l in non_empty_runs]
                avg_confidence = calculate_average_confidence(confs) or 0.0
                # Reconstruct full block text by merging lines
                answer_text = " ".join([l.text.strip() for l, p in current_lines]).strip()
                
            # Compute page ranges
            if current_lines:
                page_start = current_lines[0][1]
                page_end = current_lines[-1][1]
                line_count = len(current_lines)
            else:
                # Fallback to current line index
                page_start = 1
                page_end = 1
                line_count = 0
                
            # Empty assessment warning check
            if not answer_text.strip() and f"EMPTY_ANSWER: No content found for question {current_normalized}" not in warnings:
                warnings.append(f"EMPTY_ANSWER: No answer for question {current_normalized}")
                
            # Punctuation check
            if answer_text.strip() and re.match(r'^[\s\.,\-\?!;:\(\)\[\]]*$', answer_text):
                warnings.append(f"PUNCTUATION_ONLY: Answer for question {current_normalized} contains only punctuation")
                
            # Confidence warning check
            if avg_confidence < settings.SEGMENTATION_MIN_CONFIDENCE:
                warnings.append(f"LOW_CONFIDENCE: Average confidence for {current_normalized} is {avg_confidence:.2f} (below threshold)")
                
            # Long content warning check
            if line_count > settings.SEGMENTATION_LONG_ANSWER_THRESHOLD:
                warnings.append(f"LONG_ANSWER: Answer for question {current_normalized} has {line_count} lines (exceeds threshold)")
                
            # Check for duplicates
            is_dup = any(a.normalized_question_number == current_normalized for a in answers_list)
            if_dup = is_dup
            if is_dup:
                duplicate_questions.append(current_normalized)
                warnings.append(f"DUPLICATE_HEADER: Multiple segments found for question {current_normalized}")
                
            # Compute source pages unique list
            source_pages = list(sorted(list(set([p for l, p in current_lines])))) if current_lines else [page_start]
            confidence_level = classify_confidence(avg_confidence)

            # Instantiate SegmentedAnswer
            segmented = SegmentedAnswer(
                question_number=current_question,
                normalized_question_number=current_normalized,
                original_header=current_original,
                answer_text=answer_text,
                confidence=round(avg_confidence, 4),
                start_line=current_start,
                end_line=end_idx,
                metadata=AnswerMetadata(
                    page_start=page_start,
                    page_end=page_end,
                    line_count=line_count
                ),
                confidence_level=confidence_level,
                source_pages=source_pages,
                status="READY_FOR_EVALUATION"
            )
            answers_list.append(segmented)
            
            # Reset
            current_question = None
            current_normalized = None
            current_original = None
            current_lines = []

        overall_counter = 0
        for line, page_num, line_idx in flat_lines:
            overall_counter += 1
            text_cleaned = line.text.strip()
            
            # Check if this line is a question header
            parsed_header = parse_question_number(line.text)
            
            if parsed_header:
                # We found a new boundary! Close the active segment first.
                if current_normalized:
                    # Finalize at the line just before this one
                    finalize_active_segment(overall_counter - 1)
                    
                # Standardize matched headers
                orig, norm = parsed_header
                
                # Check for consecutive duplicate headers without intermediate text
                # We do this by seeing if the new header matches the previous normalization
                
                current_question = norm
                current_normalized = norm
                current_original = orig
                current_start = overall_counter
                current_lines = [] # lines belonging to this answer
            else:
                if current_normalized:
                    # Append this line (metadata and original object) to current answer block
                    current_lines.append((line, page_num))
                else:
                    # Text occurs before any valid headers
                    if text_cleaned:
                        unknown_sections.append(line.text)
                        
        # Finalize the last question segment in the document pool
        if current_normalized:
            finalize_active_segment(overall_counter)
        elif not answers_list and flat_lines:
            # Fallback: If no explicit question header was detected, group all document lines into Q1
            non_empty_lines = [l for l, p, idx in flat_lines if l.text.strip()]
            if non_empty_lines:
                all_text = " ".join([l.text.strip() for l, p, idx in flat_lines if l.text.strip()])
                confs = [l.confidence for l in non_empty_lines]
                avg_conf = calculate_average_confidence(confs) or 0.95
                answers_list.append(SegmentedAnswer(
                    question_number="1",
                    normalized_question_number="Q1",
                    original_header="Q1",
                    answer_text=all_text,
                    confidence=round(avg_conf, 4),
                    start_line=1,
                    end_line=len(flat_lines),
                    metadata=AnswerMetadata(
                        page_start=1,
                        page_end=flat_lines[-1][1],
                        line_count=len(flat_lines)
                    ),
                    confidence_level=classify_confidence(avg_conf),
                    source_pages=list(sorted(list(set([p for l, p, idx in flat_lines])))),
                    status="READY_FOR_EVALUATION"
                ))
            
        # 3. Check for excess unknown lines
        if len(unknown_sections) > settings.SEGMENTATION_MAX_UNKNOWN_LINES:
            warnings.append(
                f"UNKNOWN_HEADER: Text found before first valid question header exceeds {settings.SEGMENTATION_MAX_UNKNOWN_LINES} lines"
            )
            
        # 4. Check for sequence jumps
        if settings.SEGMENTATION_VALIDATE_ORDER:
            prev_num = None
            for ans in answers_list:
                num = cls.extract_numeric_part(ans.normalized_question_number)
                if num is not None:
                    if prev_num is not None and num > prev_num + 1:
                        warnings.append(f"NUMBER_SEQUENCE_JUMP: Sequence jumped from Q{prev_num} to {ans.normalized_question_number}")
                    prev_num = num

        # 5. Check for missing elements (inferring skipped numbers from 1 to max found)
        all_nums = []
        for ans in answers_list:
            num = cls.extract_numeric_part(ans.normalized_question_number)
            if num is not None:
                all_nums.append(num)
        if all_nums:
            max_num = max(all_nums)
            missing = [f"Q{n}" for n in range(1, max_num) if n not in all_nums]
        else:
            missing = []
            
        duration = time.time() - start_exec
        logger.info(
            "Answer segmentation completed in %.4fs. Segment count: %d, Warnings Count: %d",
            duration, len(answers_list), len(warnings)
        )
        
        return SegmentationResult(
            answers=answers_list,
            duplicate_questions=list(set(duplicate_questions)),
            missing_questions=missing,
            unknown_sections=unknown_sections,
            warnings=warnings,
            execution_time=round(duration, 4)
        )
