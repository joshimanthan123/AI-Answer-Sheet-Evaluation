import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.models.hwr_models import HWRLine, HWRResult
from app.providers.mock_provider import MockProvider
from app.providers.azure_provider import AzureProvider, AzureProviderError
from app.services.hwr_service import HandwritingRecognitionService, HWRServiceError

try:
    from tests.azure_fakes import make_analyze_result, make_poller
except ImportError:  # when discovered with tests/ as top-level dir
    from azure_fakes import make_analyze_result, make_poller


class TestHWRModule(unittest.TestCase):
    """
    Unit tests for:
    - MockProvider (offline deterministic HWR)
    - AzureProvider (Azure AI Document Intelligence, fully mocked — no network)
    - HandwritingRecognitionService selector + exception mapping + config validation
    """

    def setUp(self):
        # Tiny grayscale image (100x100) as a stand-in for a preprocessed page.
        self.mock_image = np.ones((100, 100), dtype=np.uint8) * 255

    # -------------------------------------------------------------
    # 1. Mock Provider Tests (must keep passing unchanged)
    # -------------------------------------------------------------
    def test_mock_provider_success(self):
        provider = MockProvider()

        result_p1 = provider.recognize(self.mock_image)
        self.assertIsInstance(result_p1, HWRResult)
        self.assertEqual(result_p1.provider, "mock")
        self.assertGreater(result_p1.confidence, 0.90)
        self.assertIn("Q1.", result_p1.text)
        self.assertIn("Artificial Intelligence", result_p1.text)
        self.assertEqual(len(result_p1.lines), 4)

        result_p2 = provider.recognize(self.mock_image, page_num=2)
        self.assertIn("Q2.", result_p2.text)
        self.assertIn("Machine Learning", result_p2.text)
        self.assertEqual(len(result_p2.lines), 3)

        result_p3 = provider.recognize(self.mock_image, page_num=3)
        self.assertIn("Q3.", result_p3.text)
        self.assertIn("Deep Learning", result_p3.text)
        self.assertEqual(len(result_p3.lines), 3)

    def test_mock_provider_invalid_image(self):
        provider = MockProvider()
        with self.assertRaises(ValueError):
            provider.recognize(None)
        with self.assertRaises(ValueError):
            provider.recognize(np.array([]))

    # -------------------------------------------------------------
    # 2. Azure Provider Initialization & Config Tests
    # -------------------------------------------------------------
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "k")
    def test_azure_provider_missing_endpoint(self):
        with self.assertRaises(AzureProviderError) as ctx:
            AzureProvider()
        self.assertIn("endpoint is not configured", str(ctx.exception))

    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", None)
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_azure_provider_missing_key(self):
        with self.assertRaises(AzureProviderError) as ctx:
            AzureProvider()
        self.assertIn("key is not configured", str(ctx.exception))

    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_MODEL", "prebuilt-read")
    def test_azure_provider_init_ok(self):
        provider = AzureProvider()
        self.assertEqual(provider.endpoint, "https://mock.cognitiveservices.azure.com")
        self.assertEqual(provider.model, "prebuilt-read")

    # -------------------------------------------------------------
    # 3. Azure Provider Result Mapping Tests (mocked SDK)
    # -------------------------------------------------------------
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key")
    @patch("app.providers.azure_provider._build_client")
    def test_azure_provider_maps_result(self, mock_build_client):
        # "Hello world" line built from two words with confidences 0.90 and 0.94.
        result = make_analyze_result([
            ("Hello world", [("Hello", 0.90, 0, 5), ("world", 0.94, 6, 5)]),
        ])
        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(result)
        mock_build_client.return_value = client

        provider = AzureProvider()
        hwr = provider.recognize(self.mock_image, page_num=2)

        self.assertEqual(hwr.provider, "azure")
        self.assertEqual(len(hwr.lines), 1)
        self.assertEqual(hwr.lines[0].text, "Hello world")
        # Line confidence = mean of word confidences within the line span.
        self.assertAlmostEqual(hwr.lines[0].confidence, 0.92, places=4)
        self.assertAlmostEqual(hwr.confidence, 0.92, places=4)
        # begin_analyze_document called exactly once for the page (one call per page).
        client.begin_analyze_document.assert_called_once()
        _, kwargs = client.begin_analyze_document.call_args
        self.assertEqual(kwargs.get("model_id"), "prebuilt-read")

    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key")
    @patch("app.providers.azure_provider._build_client")
    def test_azure_provider_preserves_line_order(self, mock_build_client):
        result = make_analyze_result([
            ("Q1.", [("Q1.", 0.99, 0, 3)]),
            ("Artificial Intelligence is the", [("Artificial", 0.95, 4, 10)]),
            ("simulation of human intelligence", [("simulation", 0.93, 15, 10)]),
        ])
        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(result)
        mock_build_client.return_value = client

        provider = AzureProvider()
        hwr = provider.recognize(self.mock_image, page_num=1)

        self.assertEqual([l.text for l in hwr.lines], [
            "Q1.",
            "Artificial Intelligence is the",
            "simulation of human intelligence",
        ])
        self.assertTrue(hwr.text.startswith("Q1.\n"))

    # -------------------------------------------------------------
    # 4. Service Layer orchestrator Tests
    # -------------------------------------------------------------
    @patch("app.config.settings.HWR_PROVIDER", "mock")
    def test_hwr_service_mock_integration(self):
        result = HandwritingRecognitionService.recognize_handwriting(self.mock_image)
        self.assertEqual(result.provider, "mock")
        self.assertGreater(result.execution_time, 0.0)

    @patch("app.config.settings.HWR_PROVIDER", "invalid-provider")
    def test_hwr_service_unsupported_provider(self):
        with self.assertRaises(HWRServiceError) as ctx:
            HandwritingRecognitionService.recognize_handwriting(self.mock_image)
        self.assertIn("Unsupported HWR provider", str(ctx.exception))

    def test_hwr_service_explicit_provider(self):
        result = HandwritingRecognitionService.recognize_handwriting(self.mock_image, provider_name="mock")
        self.assertEqual(result.provider, "mock")

    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key")
    def test_hwr_service_provider_selection(self):
        provider_mock = HandwritingRecognitionService.get_provider("mock")
        self.assertIsInstance(provider_mock, MockProvider)

        provider_azure = HandwritingRecognitionService.get_provider("azure")
        self.assertIsInstance(provider_azure, AzureProvider)

    def test_hwr_service_invalid_image(self):
        with self.assertRaises(HWRServiceError):
            HandwritingRecognitionService.recognize_handwriting(None)

    # No silent fallback: azure selected + missing config must raise, not use mock.
    @patch("app.config.settings.HWR_PROVIDER", "azure")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", None)
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_hwr_service_azure_missing_config_no_fallback(self):
        with self.assertRaises(HWRServiceError) as ctx:
            HandwritingRecognitionService.recognize_handwriting(self.mock_image)
        self.assertIn("Azure configuration error", str(ctx.exception))

    @patch("app.config.settings.HWR_PROVIDER", "mock")
    def test_validate_configuration_mock_ok(self):
        # Should not raise for mock.
        HandwritingRecognitionService.validate_configuration()

    @patch("app.config.settings.HWR_PROVIDER", "azure")
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", None)
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_validate_configuration_azure_missing_raises(self):
        with self.assertRaises(HWRServiceError):
            HandwritingRecognitionService.validate_configuration()


if __name__ == "__main__":
    unittest.main()
