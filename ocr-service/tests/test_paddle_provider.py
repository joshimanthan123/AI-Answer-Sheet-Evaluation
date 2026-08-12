import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.hwr_models import HWRResult
from app.providers.paddle_provider import PaddleHWRProvider, PaddleProviderError


class TestPaddleProvider(unittest.TestCase):
    def setUp(self):
        # Create a simple dummy image (height 100, width 200, 3 channels)
        self.image = np.ones((100, 200, 3), dtype=np.uint8) * 255

    @patch("app.providers.paddle_provider._get_ocr_engine")
    def test_provider_returns_paddle_metadata(self, mock_get_engine):
        mock_engine = MagicMock()
        # Mock PaddleOCR returning simple line results
        # Format: [ [ [box, (text, confidence)], ... ] ]
        mock_engine.ocr.return_value = [
            [
                [[[10, 10], [50, 10], [50, 20], [10, 20]], ("Test line", 0.95)]
            ]
        ]
        mock_get_engine.return_value = mock_engine

        provider = PaddleHWRProvider()
        result = provider.recognize(self.image, page_num=2)

        self.assertIsInstance(result, HWRResult)
        self.assertEqual(result.provider, "paddle")
        self.assertEqual(result.text, "Test line")
        self.assertEqual(len(result.lines), 1)
        self.assertEqual(result.lines[0].text, "Test line")
        self.assertAlmostEqual(result.lines[0].confidence, 0.95)
        self.assertEqual(result.confidence, 0.95)

    @patch("app.providers.paddle_provider._get_ocr_engine")
    def test_sorting_and_grouping_logic(self, mock_get_engine):
        mock_engine = MagicMock()
        # Mock PaddleOCR returning multiple lines with horizontal/vertical offsets.
        # Line 1: overlaps horizontally with two boxes:
        # Box A: X from 10 to 50, Y from 10 to 25. Text: "Left"
        # Box B: X from 60 to 100, Y from 12 to 24. Text: "Right" (similar Y center, should merge)
        # Line 2: vertical offset:
        # Box C: X from 10 to 120, Y from 50 to 65. Text: "Bottom line"
        mock_engine.ocr.return_value = [
            [
                [[[60, 12], [100, 12], [100, 24], [60, 24]], ("Right", 0.90)],
                [[[10, 10], [50, 10], [50, 25], [10, 25]], ("Left", 0.80)],
                [[[10, 50], [120, 50], [120, 65], [10, 65]], ("Bottom line", 0.85)],
            ]
        ]
        mock_get_engine.return_value = mock_engine

        provider = PaddleHWRProvider()
        result = provider.recognize(self.image)

        # Expected output after sorting/merging:
        # Line 1: "Left Right" (since Left has X=10 and Right has X=60, grouped into same band, then sorted horizontally)
        # Line 2: "Bottom line" (since Y is lower down)
        self.assertEqual(len(result.lines), 2)
        self.assertEqual(result.lines[0].text, "Left Right")
        self.assertEqual(result.lines[1].text, "Bottom line")
        # Line confidence average
        self.assertAlmostEqual(result.lines[0].confidence, 0.85)  # (0.80 + 0.90) / 2
        self.assertAlmostEqual(result.lines[1].confidence, 0.85)
        self.assertAlmostEqual(result.confidence, 0.85)

    @patch("app.providers.paddle_provider._get_ocr_engine")
    def test_empty_ocr_result_handling(self, mock_get_engine):
        mock_engine = MagicMock()
        # Test engine returning empty detections or None
        mock_engine.ocr.return_value = [None]
        mock_get_engine.return_value = mock_engine

        provider = PaddleHWRProvider()
        result = provider.recognize(self.image)
        self.assertEqual(result.text, "")
        self.assertEqual(len(result.lines), 0)
        self.assertEqual(result.confidence, 0.0)

    @patch("app.providers.paddle_provider._get_ocr_engine")
    def test_ocr_exception_mapped(self, mock_get_engine):
        mock_engine = MagicMock()
        mock_engine.ocr.side_effect = Exception("Neural Network inference failed")
        mock_get_engine.return_value = mock_engine

        provider = PaddleHWRProvider()
        with self.assertRaises(PaddleProviderError):
            provider.recognize(self.image)

    def test_invalid_image_input_raises(self):
        provider = PaddleHWRProvider()
        with self.assertRaises(ValueError):
            provider.recognize(None)


if __name__ == "__main__":
    unittest.main()
