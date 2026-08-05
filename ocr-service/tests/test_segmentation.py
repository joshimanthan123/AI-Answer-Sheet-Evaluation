import os
import sys
import unittest
import time
from typing import List

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.models.hwr_models import HWRResult, HWRLine
from app.services.segmentation_service import AnswerSegmentationService


class TestAnswerSegmentation(unittest.TestCase):
    """
    Unit test suite for AnswerSegmentationService.
    Covers regex matches, priorities, multi-page mergers, warning flags,
    boundary edge-cases, and execution benchmarks.
    """

    def setUp(self):
        # Sample lines representing typical inputs
        self.mock_lines = [
            HWRLine(text="Ql. What is AI?", confidence=0.98),
            HWRLine(text="Artificial Intelligence represents the core simulation", confidence=0.95),
            HWRLine(text="of human thoughts by machinery systems.", confidence=0.97),
            HWRLine(text="", confidence=1.00), # Empty separator line
            HWRLine(text="2(a) Define ML.", confidence=0.96),
            HWRLine(text="Machine Learning is a subset of AI algorithmics.", confidence=0.92),
        ]
        self.mock_result = HWRResult(
            text="Mock text content...",
            confidence=0.9633,
            lines=self.mock_lines,
            provider="mock",
            execution_time=0.045
        )

    # -------------------------------------------------------------
    # 1. Verification of OCR typos & Regex priorities
    # -------------------------------------------------------------
    def test_ocr_corrections_and_priorities(self):
        # We define a few lines containing typos to test parser corrections
        typo_lines = [
            HWRLine(text="Ql. Question One", confidence=0.9),
            HWRLine(text="QI. Second Match", confidence=0.85),
            HWRLine(text="O1. Third Match", confidence=0.88),
            HWRLine(text="Section A. Marks: 50", confidence=0.95),
        ]
        res = HWRResult(text="", confidence=0.9, lines=typo_lines, provider="mock", execution_time=0.01)
        segment_result = AnswerSegmentationService.segment_answers(res)
        
        # Check normalized question number values
        answ = segment_result.answers
        self.assertEqual(len(answ), 4)
        
        # Ql. -> Q1
        self.assertEqual(answ[0].normalized_question_number, "Q1")
        self.assertEqual(answ[0].original_header, "Ql.")
        
        # QI. -> Q1
        self.assertEqual(answ[1].normalized_question_number, "Q1")
        self.assertEqual(answ[1].original_header, "QI.")
        
        # O1. -> Q1
        self.assertEqual(answ[2].normalized_question_number, "Q1")
        self.assertEqual(answ[2].original_header, "O1.")
        
        # Section A -> SecA
        self.assertEqual(answ[3].normalized_question_number, "SecA")
        self.assertEqual(answ[3].original_header, "Section A")

    def test_roman_numerals_matching(self):
        roman_lines = [
            HWRLine(text="I. Initial topic", confidence=0.9),
            HWRLine(text="II. Secondary item", confidence=0.92),
            HWRLine(text="IV. Third item", confidence=0.95),
        ]
        res = HWRResult(text="", confidence=0.9, lines=roman_lines, provider="mock", execution_time=0.01)
        segment_result = AnswerSegmentationService.segment_answers(res)
        
        self.assertEqual(len(segment_result.answers), 3)
        self.assertEqual(segment_result.answers[0].normalized_question_number, "RomanI")
        self.assertEqual(segment_result.answers[1].normalized_question_number, "RomanII")
        self.assertEqual(segment_result.answers[2].normalized_question_number, "RomanIV")

    # -------------------------------------------------------------
    # 2. Multi-page sequence merges & Reading-orders
    # -------------------------------------------------------------
    def test_multipage_continuation(self):
        # Two pages where answer to Q1 spans across page boundaries
        page1 = HWRResult(
            text="", confidence=0.95,
            lines=[
                HWRLine(text="Q1. Start of Q1", confidence=0.98),
                HWRLine(text="Line 1 of answer.", confidence=0.96),
            ],
            provider="mock", execution_time=0.02
        )
        page2 = HWRResult(
            text="", confidence=0.90,
            lines=[
                HWRLine(text="Line 2 of answer (continued on next page).", confidence=0.92),
                HWRLine(text="Q2. Next question", confidence=0.95),
                HWRLine(text="Answer to Q2.", confidence=0.99),
            ],
            provider="mock", execution_time=0.02
        )
        
        segment_result = AnswerSegmentationService.segment_answers([page1, page2])
        self.assertEqual(len(segment_result.answers), 2)
        
        q1_answer = segment_result.answers[0]
        self.assertEqual(q1_answer.normalized_question_number, "Q1")
        self.assertIn("Line 1 of answer. Line 2 of answer (continued on next page).", q1_answer.answer_text)
        # page starts 1, page ends 2 (answer crosses boundaries)
        self.assertEqual(q1_answer.metadata.page_start, 1)
        self.assertEqual(q1_answer.metadata.page_end, 2)
        self.assertEqual(q1_answer.metadata.line_count, 2) # line count excludes the header line itself

    # -------------------------------------------------------------
    # 3. Arithmetic confidence calculates
    # -------------------------------------------------------------
    def test_arithmetic_confidence_calculation(self):
        # Ensure separator empty lines do not drag down average confidence calculation
        lines = [
            HWRLine(text="Q1.", confidence=1.00),
            HWRLine(text="Topic definition.", confidence=0.90),
            HWRLine(text="", confidence=0.20), # Empty line
            HWRLine(text="Proof check.", confidence=0.94),
        ]
        res = HWRResult(text="", confidence=0.8, lines=lines, provider="mock", execution_time=0.01)
        segment_result = AnswerSegmentationService.segment_answers(res)
        
        self.assertEqual(len(segment_result.answers), 1)
        # (0.90 + 0.94) / 2 = 0.92
        self.assertAlmostEqual(segment_result.answers[0].confidence, 0.92)

    # -------------------------------------------------------------
    # 4. Custom warning configurations
    # -------------------------------------------------------------
    def test_warnings_and_validations(self):
        # Setup inputs which trigger EMPTY_ANSWER, LOW_CONFIDENCE, DUPLICATE_HEADER, NUMBER_SEQUENCE_JUMP
        faulty_lines = [
            # 1. Text before first header
            HWRLine(text="Unrecognized line one", confidence=0.90),
            HWRLine(text="Unrecognized line two", confidence=0.90),
            HWRLine(text="Unrecognized line three", confidence=0.90),
            HWRLine(text="Unrecognized line four", confidence=0.90),
            HWRLine(text="Unrecognized line five", confidence=0.90),
            HWRLine(text="Unrecognized line six", confidence=0.90), # 6 lines exceeds settings default (5)
            
            # 2. Duplicate header and empty answer
            HWRLine(text="Q1. Header", confidence=0.95),
            HWRLine(text="Q1. Duplicate header", confidence=0.95),
            # Empty content -> EMPTY_ANSWER
            
            # 3. Numeric sequence jump Q1 -> Q5
            HWRLine(text="Q5. Jumped number", confidence=0.95),
            HWRLine(text="Low confidence answer text.", confidence=0.25), # Below 0.50
        ]
        res = HWRResult(text="", confidence=0.8, lines=faulty_lines, provider="mock", execution_time=0.01)
        segment_result = AnswerSegmentationService.segment_answers(res)
        
        warnings = segment_result.warnings
        
        # Check UNKNOWN_HEADER trigger
        self.assertTrue(any(w.startswith("UNKNOWN_HEADER") for w in warnings))
        # Check DUPLICATE_HEADER trigger
        self.assertTrue(any(w.startswith("DUPLICATE_HEADER") for w in warnings))
        # Check EMPTY_ANSWER trigger
        self.assertTrue(any(w.startswith("EMPTY_ANSWER") for w in warnings))
        # Check NUMBER_SEQUENCE_JUMP trigger
        self.assertTrue(any(w.startswith("NUMBER_SEQUENCE_JUMP") for w in warnings))
        # Check LOW_CONFIDENCE trigger
        self.assertTrue(any(w.startswith("LOW_CONFIDENCE") for w in warnings))

    # -------------------------------------------------------------
    # 5. Performance benchmark verification
    # -------------------------------------------------------------
    def test_performance_benchmark(self):
        # Generate 5-pages of data (~300 lines of OCR transcripts)
        pages: List[HWRResult] = []
        q_counter = 1
        for p in range(5):
            lines = []
            for _ in range(10): # 10 questions per page
                lines.append(HWRLine(text=f"Q{q_counter}. Question title text.", confidence=0.95))
                lines.append(HWRLine(text="Detail line one of the answer text.", confidence=0.94))
                lines.append(HWRLine(text="Detail line two of the answer text.", confidence=0.93))
                lines.append(HWRLine(text="Detail line three of the answer text.", confidence=0.92))
                lines.append(HWRLine(text="Detail line four of the answer text.", confidence=0.91))
                lines.append(HWRLine(text="", confidence=1.00))
                q_counter += 1
            pages.append(HWRResult(text="", confidence=0.94, lines=lines, provider="mock", execution_time=0.01))
            
        start_time = time.time()
        segment_result = AnswerSegmentationService.segment_answers(pages)
        elapsed_ms = (time.time() - start_time) * 1000
        
        print(f"Processed {len(segment_result.answers)*6} lines in {elapsed_ms:.2f} ms")
        self.assertEqual(len(segment_result.answers), 50)
        # Benchmark restriction: execution time must be <100ms
        self.assertLess(elapsed_ms, 100.0)


if __name__ == "__main__":
    unittest.main()
