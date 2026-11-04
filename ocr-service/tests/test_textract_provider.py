import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np
from botocore.exceptions import ClientError, EndpointConnectionError, ConnectTimeoutError

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.hwr_models import HWRResult
from app.providers.textract_provider import TextractHWRProvider, TextractProviderError
from app.services.hwr_service import HandwritingRecognitionService
from app.providers.mock_provider import MockProvider
from app.providers.paddle_provider import PaddleHWRProvider


def make_line_block(text: str, confidence: float, left=0.1, top=0.1, width=0.5, height=0.05):
    """Creates a mock Amazon Textract LINE block."""
    right = left + width
    bottom = top + height
    return {
        "BlockType": "LINE",
        "Id": f"line-{text[:5]}",
        "Text": text,
        "Confidence": confidence,
        "Geometry": {
            "BoundingBox": {
                "Width": width,
                "Height": height,
                "Left": left,
                "Top": top
            },
            "Polygon": [
                {"X": left, "Y": top},
                {"X": right, "Y": top},
                {"X": right, "Y": bottom},
                {"X": left, "Y": bottom}
            ]
        }
    }


def make_client_error(code: str, message: str):
    """Creates a botocore ClientError."""
    return ClientError(
        error_response={"Error": {"Code": code, "Message": message}},
        operation_name="DetectDocumentText"
    )


class TestTextractProvider(unittest.TestCase):
    def setUp(self):
        # 200x400 dummy image (height=200, width=400)
        self.image = np.ones((200, 400, 3), dtype=np.uint8) * 255

    @patch("app.providers.textract_provider._build_client")
    def test_successful_line_extraction(self, mock_build_client):
        """Verify successful line extraction and full text concatenation."""
        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = {
            "DocumentMetadata": {"Pages": 1},
            "Blocks": [
                make_line_block("Q1. What is an operating system?", 98.5),
                make_line_block("An operating system manages computer hardware", 94.2),
                make_line_block("and software resources.", 91.3)
            ]
        }
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider(region_name="us-east-1")
        result = provider.recognize(self.image, page_num=1)

        self.assertIsInstance(result, HWRResult)
        self.assertEqual(result.provider, "textract")
        self.assertEqual(len(result.lines), 3)
        self.assertEqual(result.lines[0].text, "Q1. What is an operating system?")
        self.assertEqual(result.lines[1].text, "An operating system manages computer hardware")
        self.assertEqual(result.lines[2].text, "and software resources.")
        self.assertEqual(
            result.text,
            "Q1. What is an operating system?\nAn operating system manages computer hardware\nand software resources."
        )

    @patch("app.providers.textract_provider._build_client")
    def test_confidence_and_bounding_box_mapping(self, mock_build_client):
        """Verify confidence is normalized to 0.0-1.0 and bounding boxes map to pixel coordinates."""
        mock_client = MagicMock()
        # BoundingBox at left=0.1 (40px), top=0.2 (40px), width=0.5 (200px), height=0.1 (20px)
        mock_client.detect_document_text.return_value = {
            "Blocks": [
                make_line_block("Process control block", 95.50, left=0.1, top=0.2, width=0.5, height=0.1)
            ]
        }
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider(region_name="us-east-1")
        result = provider.recognize(self.image)

        line = result.lines[0]
        # Textract 95.50% -> normalized 0.955
        self.assertAlmostEqual(line.confidence, 0.9550, places=4)
        self.assertAlmostEqual(result.confidence, 0.9550, places=4)

        # Polygon coordinates scaled to image shape (200 h, 400 w)
        # Expected: [[40, 40], [240, 40], [240, 60], [40, 60]]
        self.assertIsNotNone(line.boundingBox)
        self.assertEqual(line.boundingBox, [[40, 40], [240, 40], [240, 60], [40, 60]])

    @patch("app.providers.textract_provider._build_client")
    def test_empty_textract_response(self, mock_build_client):
        """Verify empty response returns safe empty HWRResult."""
        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = {"Blocks": []}
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        result = provider.recognize(self.image)

        self.assertEqual(result.text, "")
        self.assertEqual(len(result.lines), 0)
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.provider, "textract")

    @patch("app.providers.textract_provider._build_client")
    def test_access_denied_exception(self, mock_build_client):
        """Verify AccessDeniedException surfaces clear actionable permission error."""
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = make_client_error(
            "AccessDeniedException",
            "User is not authorized to perform: textract:DetectDocumentText"
        )
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        with self.assertRaises(TextractProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("Access Denied", str(ctx.exception))
        self.assertIn("permissions", str(ctx.exception).lower())

    @patch("app.providers.textract_provider._build_client")
    def test_expired_credentials_exception(self, mock_build_client):
        """Verify ExpiredToken surfaces clear session expiration error."""
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = make_client_error(
            "ExpiredToken",
            "The security token included in the request is expired"
        )
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        with self.assertRaises(TextractProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("expired", str(ctx.exception).lower())

    @patch("app.providers.textract_provider._build_client")
    def test_unsupported_document_exception(self, mock_build_client):
        """Verify UnsupportedDocumentException raises clear format error."""
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = make_client_error(
            "UnsupportedDocumentException",
            "Request has unsupported document format"
        )
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        with self.assertRaises(TextractProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("unsupported document format", str(ctx.exception).lower())

    @patch("app.providers.textract_provider._build_client")
    def test_network_connection_error(self, mock_build_client):
        """Verify network endpoint connectivity failure is mapped cleanly."""
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = EndpointConnectionError(
            endpoint_url="https://textract.us-east-1.amazonaws.com"
        )
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        with self.assertRaises(TextractProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("network failure", str(ctx.exception).lower())

    @patch("app.providers.textract_provider._build_client")
    def test_network_timeout_error(self, mock_build_client):
        """Verify connection timeout is mapped cleanly."""
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = ConnectTimeoutError(
            endpoint_url="https://textract.us-east-1.amazonaws.com"
        )
        mock_build_client.return_value = mock_client

        provider = TextractHWRProvider()
        with self.assertRaises(TextractProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("network failure", str(ctx.exception).lower())

    def test_invalid_image_raises_value_error(self):
        """Verify invalid image input fails early."""
        provider = TextractHWRProvider()
        with self.assertRaises(ValueError):
            provider.recognize(None)
        with self.assertRaises(ValueError):
            provider.recognize(np.array([]))

    @patch("app.providers.textract_provider._build_client")
    def test_oversized_image_compression_fallback(self, mock_build_client):
        """Verify large image is converted to JPEG when PNG would exceed 5 MB."""
        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = {
            "Blocks": [make_line_block("Compressed text", 92.0)]
        }
        mock_build_client.return_value = mock_client

        # Create large image array that creates large PNG bytes
        large_img = np.random.randint(0, 256, (2000, 2000, 3), dtype=np.uint8)

        provider = TextractHWRProvider()
        result = provider.recognize(large_img)

        self.assertEqual(len(result.lines), 1)
        self.assertEqual(result.lines[0].text, "Compressed text")
        # Verify the bytes sent to AWS were <= 5 MB
        call_args = mock_client.detect_document_text.call_args
        sent_bytes = call_args[1]["Document"]["Bytes"]
        self.assertLessEqual(len(sent_bytes), 5 * 1024 * 1024)

    def test_provider_factory_selection_and_preservation(self):
        """Verify provider selection works and preserves paddle, paddleocr, and mock."""
        p_textract = HandwritingRecognitionService.get_provider("textract")
        self.assertIsInstance(p_textract, TextractHWRProvider)

        p_paddle = HandwritingRecognitionService.get_provider("paddle")
        self.assertIsInstance(p_paddle, PaddleHWRProvider)

        p_paddleocr = HandwritingRecognitionService.get_provider("paddleocr")
        self.assertIsInstance(p_paddleocr, PaddleHWRProvider)

        p_mock = HandwritingRecognitionService.get_provider("mock")
        self.assertIsInstance(p_mock, MockProvider)

    @patch("app.config.settings.HWR_PROVIDER", None)
    def test_textract_selected_when_hwr_provider_unset(self):
        """Requirement 10: Verify Textract is selected when HWR_PROVIDER is unset."""
        provider = HandwritingRecognitionService.get_provider()
        self.assertIsInstance(provider, TextractHWRProvider)

        # Also verify when HWR_PROVIDER is empty string
        with patch("app.config.settings.HWR_PROVIDER", ""):
            provider_empty = HandwritingRecognitionService.get_provider()
            self.assertIsInstance(provider_empty, TextractHWRProvider)

    def test_explicitly_selecting_paddleocr_works(self):
        """Requirement 10: Verify explicitly selecting PaddleOCR ('paddle' or 'paddleocr') works."""
        provider_paddle = HandwritingRecognitionService.get_provider("paddle")
        self.assertIsInstance(provider_paddle, PaddleHWRProvider)

        provider_paddleocr = HandwritingRecognitionService.get_provider("paddleocr")
        self.assertIsInstance(provider_paddleocr, PaddleHWRProvider)

    def test_mock_remains_available_for_tests(self):
        """Requirement 10: Verify Mock remains available for tests via factory and service."""
        provider_mock = HandwritingRecognitionService.get_provider("mock")
        self.assertIsInstance(provider_mock, MockProvider)

        # Service-level invocation with mock provider
        result = HandwritingRecognitionService.recognize_handwriting(self.image, provider_name="mock")
        self.assertIsInstance(result, HWRResult)
        self.assertEqual(result.provider, "mock")
        self.assertGreater(len(result.lines), 0)

    @patch("app.config.settings.HWR_PROVIDER", "textract")
    @patch("app.providers.textract_provider._build_client")
    def test_textract_failure_reported_clearly_without_silent_fallback(self, mock_build_client):
        """Requirement 10: Verify Textract failures raise HWRServiceError without silently switching providers."""
        from app.services.hwr_service import HWRServiceError

        # Simulate AWS ExpiredToken failure
        mock_client = MagicMock()
        mock_client.detect_document_text.side_effect = make_client_error(
            "ExpiredToken", "The security token included in the request is expired"
        )
        mock_build_client.return_value = mock_client

        with self.assertRaises(HWRServiceError) as ctx:
            HandwritingRecognitionService.recognize_handwriting(self.image)

        error_msg = str(ctx.exception)
        # Must clearly identify Textract and the underlying reason
        self.assertIn("Textract HWR Engine failure", error_msg)
        self.assertIn("expired", error_msg.lower())

        # Simulate AWS AccessDeniedException failure
        mock_client.detect_document_text.side_effect = make_client_error(
            "AccessDeniedException", "User is not authorized to perform: textract:DetectDocumentText"
        )
        with self.assertRaises(HWRServiceError) as ctx:
            HandwritingRecognitionService.recognize_handwriting(self.image)

        error_msg_denied = str(ctx.exception)
        self.assertIn("Textract HWR Engine failure", error_msg_denied)
        self.assertIn("access denied", error_msg_denied.lower())


if __name__ == "__main__":
    unittest.main()

