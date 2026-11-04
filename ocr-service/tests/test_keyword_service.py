import unittest
from app.services.keyword_service import KeywordService

class TestKeywordService(unittest.TestCase):
    """
    Unit tests ensuring correct phrase matching and alphanumeric-safe boundary checks on keyword extraction.
    """

    def test_basic_keyword_matching(self) -> None:
        student_answer = "We are using TCP/IP protocol and C++ programming language for the OSI model."
        expected = ["TCP/IP", "C++", "OSI model", "missing_concept"]

        matched = KeywordService.extract_matched_keywords(student_answer, expected)
        missing = KeywordService.extract_missing_keywords(student_answer, expected)

        # Matched list should preserve original list representation/casing
        self.assertEqual(matched, ["TCP/IP", "C++", "OSI model"])
        self.assertEqual(missing, ["missing_concept"])

    def test_case_and_whitespace_insensitivity(self) -> None:
        student_answer = "   tcp/ip    c++   osi model   "
        expected = ["TCP/IP", "C++", "OSI Model"]

        matched = KeywordService.extract_matched_keywords(student_answer, expected)
        self.assertEqual(matched, ["TCP/IP", "C++", "OSI Model"])

    def test_duplicate_keywords(self) -> None:
        student_answer = "database database schema"
        expected = ["database", "DATABASE", "schema"]

        matched = KeywordService.extract_matched_keywords(student_answer, expected)
        # Should deduplicate returning only the first match candidate preserving its case
        self.assertEqual(matched, ["database", "schema"])

    def test_safe_alphanumeric_boundary_check(self) -> None:
        # "database" should match "database schema"
        # "database" should NOT match "mydatabase" or "databases"
        student_answer = "databases are different from mydatabase, but database schema works."
        expected = ["database"]

        matched = KeywordService.extract_matched_keywords(student_answer, expected)
        self.assertEqual(matched, ["database"])

        # TCP/IP should NOT match TCP/IPx but should match TCP/IP
        self.assertEqual(
            KeywordService.extract_matched_keywords("tcp/ipx", ["TCP/IP"]),
            []
        )
        self.assertEqual(
            KeywordService.extract_matched_keywords("tcp/ip protocol", ["TCP/IP"]),
            ["TCP/IP"]
        )

        # C++ should NOT match C++17 but should match C++
        self.assertEqual(
            KeywordService.extract_matched_keywords("c++17 compiler", ["c++"]),
            []
        )
        self.assertEqual(
            KeywordService.extract_matched_keywords("c++ compiler", ["c++"]),
            ["c++"]
        )

    def test_empty_expected(self) -> None:
        self.assertEqual(KeywordService.extract_matched_keywords("some answer", []), [])
        self.assertEqual(KeywordService.extract_missing_keywords("some answer", []), [])
