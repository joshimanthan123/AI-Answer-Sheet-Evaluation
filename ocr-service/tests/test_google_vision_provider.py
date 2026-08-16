import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.hwr_models import HWRResult
from app.providers.google_vision_provider import GoogleVisionHWRProvider, GoogleVisionProviderError
from app.config import settings

# Helper mock builders to simulate Google Cloud Vision response structures without real SDK classes
def make_detected_break(break_type_val):
    prop = MagicMock()
    detected_break = MagicMock()
    detected_break.type_ = break_type_val
    prop.detected_break = detected_break
    return prop

def make_symbol(text_char, break_type_val=None):
    symbol = MagicMock()
    symbol.text = text_char
    if break_type_val is not None:
        symbol.property = make_detected_break(break_type_val)
    else:
        symbol.property = None
    return symbol

def make_word(word_str, confidence=1.0, break_type_val=None):
    word = MagicMock()
    word.confidence = confidence
    symbols = []
    for i, char in enumerate(word_str):
        # Apply the line break to the last symbol of the word
        is_last = (i == len(word_str) - 1)
        sym_break = break_type_val if is_last else None
        symbols.append(make_symbol(char, sym_break))
    word.symbols = symbols
    return word

def make_paragraph(words):
    para = MagicMock()
    para.words = words
    return para

def make_block(paragraphs):
    block = MagicMock()
    block.paragraphs = paragraphs
    return block

def make_page(blocks):
    page = MagicMock()
    page.blocks = blocks
    return page

def make_response(pages, error_message=None):
    response = MagicMock()
    if error_message:
        response.error.message = error_message
    else:
        response.error = None
        
    full_annot = MagicMock()
    full_annot.pages = pages
    response.full_text_annotation = full_annot
    return response


class TestGoogleVisionProvider(unittest.TestCase):
    def setUp(self):
        self.image = np.ones((100, 100), dtype=np.uint8) * 255
        self.settings_patcher = patch.multiple(
            "app.config.settings",
            GOOGLE_CLOUD_PROJECT_ID="mock-project",
            GOOGLE_APPLICATION_CREDENTIALS=None,
            GOOGLE_VISION_LANGUAGE_HINT=None,
            GOOGLE_VISION_TIMEOUT_SECONDS=30.0
        )
        self.settings_patcher.start()

    def tearDown(self):
        self.settings_patcher.stop()

    @patch("os.path.exists", return_value=False)
    @patch("app.config.settings.GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent/creds.json")
    def test_missing_credentials_file_raises(self, mock_exists):
        with self.assertRaises(GoogleVisionProviderError) as ctx:
            GoogleVisionHWRProvider()
        self.assertIn("file not found at", str(ctx.exception))

    @patch("app.providers.google_vision_provider._build_client")
    def test_successful_ocr_and_layout_mapping(self, mock_build_client):
        # Set up a fake page:
        # Paragraph 1: "Hello" (line break 5), "world!" (paragraph end)
        # Paragraph 2: "Line" (space), "two" (paragraph end)
        word1 = make_word("Hello", confidence=0.90, break_type_val=5) # 5 = LINE_BREAK
        word2 = make_word("world!", confidence=0.80) 
        word3 = make_word("Line", confidence=0.95)
        word4 = make_word("two", confidence=0.85)

        para1 = make_paragraph([word1, word2])
        para2 = make_paragraph([word3, word4])
        block1 = make_block([para1, para2])
        page1 = make_page([block1])
        
        responseMock = make_response([page1])
        client = MagicMock()
        client.document_text_detection.return_value = responseMock
        mock_build_client.return_value = client

        provider = GoogleVisionHWRProvider()
        result = provider.recognize(self.image)
        
        self.assertIsInstance(result, HWRResult)
        self.assertEqual(result.provider, "google_vision")
        self.assertEqual(len(result.lines), 3) # "Hello", "world!", "Line two"
        self.assertEqual(result.lines[0].text, "Hello")
        self.assertEqual(result.lines[1].text, "world!")
        self.assertEqual(result.lines[2].text, "Line two")
        
        self.assertAlmostEqual(result.lines[0].confidence, 0.90, places=4)
        self.assertAlmostEqual(result.lines[1].confidence, 0.80, places=4)
        self.assertAlmostEqual(result.lines[2].confidence, 0.90, places=4) # mean of 0.95 and 0.85
        
        # Mean of overall lines (0.90, 0.80, 0.90) = 0.8667
        self.assertAlmostEqual(result.confidence, 0.8667, places=4)
        self.assertEqual(result.text, "Hello\nworld!\nLine two")
        
        # Verify call arguments
        client.document_text_detection.assert_called_once()
        _, kwargs = client.document_text_detection.call_args
        self.assertEqual(kwargs.get("timeout"), 30.0)

    @patch("app.providers.google_vision_provider._build_client")
    def test_empty_result(self, mock_build_client):
        responseMock = make_response([])
        client = MagicMock()
        client.document_text_detection.return_value = responseMock
        mock_build_client.return_value = client

        provider = GoogleVisionHWRProvider()
        result = provider.recognize(self.image)
        self.assertEqual(result.text, "")
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(len(result.lines), 0)

    @patch("app.providers.google_vision_provider._build_client")
    def test_api_error_raised(self, mock_build_client):
        responseMock = make_response([], error_message="API Key is invalid")
        client = MagicMock()
        client.document_text_detection.return_value = responseMock
        mock_build_client.return_value = client

        provider = GoogleVisionHWRProvider()
        with self.assertRaises(GoogleVisionProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("Google Cloud Vision API returned an error: API Key is invalid", str(ctx.exception))

    @patch("app.providers.google_vision_provider._build_client")
    def test_timeout_mapped_error(self, mock_build_client):
        class DeadlineExceeded(Exception):
            pass
        client = MagicMock()
        client.document_text_detection.side_effect = DeadlineExceeded("Timeout exceeded")
        mock_build_client.return_value = client

        provider = GoogleVisionHWRProvider()
        with self.assertRaises(GoogleVisionProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("timed out", str(ctx.exception).lower())

    @patch("app.providers.google_vision_provider._build_client")
    def test_auth_error_mapped_error(self, mock_build_client):
        class GoogleAuthError(Exception):
            pass
        client = MagicMock()
        client.document_text_detection.side_effect = GoogleAuthError("Invalid credentials")
        mock_build_client.return_value = client

        provider = GoogleVisionHWRProvider()
        with self.assertRaises(GoogleVisionProviderError) as ctx:
            provider.recognize(self.image)
        self.assertIn("authentication failed", str(ctx.exception).lower())

    def test_invalid_image_raises(self):
        provider = GoogleVisionHWRProvider()
        with self.assertRaises(ValueError):
            provider.recognize(None)

    @patch("app.config.settings.GOOGLE_VISION_LANGUAGE_HINT", "en-t-i0-handwrit")
    @patch("app.providers.google_vision_provider._build_client")
    @patch("google.cloud.vision.ImageContext")
    def test_language_hint_propagation(self, mock_image_context, mock_build_client):
        # Setup fakes so call passes to execution
        word = make_word("test")
        responseMock = make_response([make_page([make_block([make_paragraph([word])])])])
        client = MagicMock()
        client.document_text_detection.return_value = responseMock
        mock_build_client.return_value = client

        # Mock ImageContext constructor mapping
        mock_image_context.return_value = "mock_context_instance"

        provider = GoogleVisionHWRProvider()
        provider.recognize(self.image)

        # Assert context constructed with correct language hint
        mock_image_context.assert_called_once_with(language_hints=["en-t-i0-handwrit"])
        # Assert client called with context
        _, kwargs = client.document_text_detection.call_args
        self.assertEqual(kwargs.get("image_context"), "mock_context_instance")


if __name__ == "__main__":
    unittest.main()
