import unittest
from app.services.evaluation_response_parser import EvaluationResponseParser
from app.core.exceptions import EvaluationResponseParseError, EvaluationResponseValidationError

class TestEvaluationResponseParser(unittest.TestCase):
    """
    Unit tests ensuring parsing robustness for various raw LLM response outputs.
    """

    def test_parse_response_valid_plain_json(self) -> None:
        raw = '{"marks": 4.5, "feedback": "Good attempt", "missing_points": [], "strengths": ["clear code"], "confidence": 0.85}'
        res = EvaluationResponseParser.parse_response(raw)
        self.assertEqual(res.marks, 4.5)
        self.assertEqual(res.feedback, "Good attempt")
        self.assertEqual(res.confidence, 0.85)

    def test_parse_response_markdown_json(self) -> None:
        raw = """
Some raw conversational text here...
```json
{
  "marks": 3.0,
  "feedback": "Somewhat correct",
  "missing_points": ["Detail A"],
  "strengths": ["Concept B"],
  "confidence": 0.90
}
```
And some trails too.
"""
        res = EvaluationResponseParser.parse_response(raw)
        self.assertEqual(res.marks, 3.0)
        self.assertEqual(res.feedback, "Somewhat correct")
        self.assertEqual(res.missing_points, ["Detail A"])
        self.assertEqual(res.strengths, ["Concept B"])
        self.assertEqual(res.confidence, 0.90)

    def test_parse_response_invalid_json(self) -> None:
        raw = "Not a JSON payload"
        with self.assertRaises(EvaluationResponseParseError):
            EvaluationResponseParser.parse_response(raw)

    def test_parse_response_missing_fields(self) -> None:
        raw = '{"marks": 4.0, "feedback": "Missing other fields"}'
        with self.assertRaises(EvaluationResponseValidationError):
            EvaluationResponseParser.parse_response(raw)

    def test_parse_response_invalid_values(self) -> None:
        raw = '{"marks": -1.0, "feedback": "Negative marks", "missing_points": [], "strengths": [], "confidence": 0.5}'
        with self.assertRaises(EvaluationResponseValidationError):
            EvaluationResponseParser.parse_response(raw)

        raw2 = '{"marks": 4.0, "feedback": "High confidence", "missing_points": [], "strengths": [], "confidence": 1.2}'
        with self.assertRaises(EvaluationResponseValidationError):
            EvaluationResponseParser.parse_response(raw2)
