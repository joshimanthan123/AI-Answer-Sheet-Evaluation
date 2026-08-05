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


class TestHWRModule(unittest.TestCase):
    """
    Suite containing unit tests for testing:
    - Mock Recognition Provider
    - Azure AI Vision client with mocked API responses (unauthorized, timeout, failed, succeeded)
    - Handwriting Recognition Service selector and Exception mapping
    """

    def setUp(self):
        # Create a tiny mock image (100x100 grayscale) for testing inputs
        self.mock_image = np.ones((100, 100), dtype=np.uint8) * 255

    # -------------------------------------------------------------
    # 1. Mock Provider Tests
    # -------------------------------------------------------------
    def test_mock_provider_success(self):
        provider = MockProvider()
        result = provider.recognize(self.mock_image)
        
        self.assertIsInstance(result, HWRResult)
        self.assertEqual(result.provider, "mock")
        self.assertGreater(result.confidence, 0.90)
        self.assertGreater(result.execution_time, 0.0)
        self.assertIn("Q1.", result.text)
        self.assertIn("Machine Learning", result.text)
        self.assertEqual(len(result.lines), 8)

    def test_mock_provider_invalid_image(self):
        provider = MockProvider()
        with self.assertRaises(ValueError):
            provider.recognize(None)

        with self.assertRaises(ValueError):
            # empty dimension
            provider.recognize(np.array([]))

    # -------------------------------------------------------------
    # 2. Azure Provider Initialization & Setup Tests
    # -------------------------------------------------------------
    @patch("app.config.settings.AZURE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_azure_provider_missing_config(self):
        with self.assertRaises(AzureProviderError) as context:
            AzureProvider()
        self.assertIn("Azure endpoint is not configured", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_azure_provider_missing_key(self):
        with self.assertRaises(AzureProviderError) as context:
            AzureProvider()
        self.assertIn("Azure API key is not configured", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    def test_azure_provider_api_url_formatting(self):
        provider = AzureProvider()
        self.assertEqual(provider.api_url, "https://mock.cognitiveservices.azure.com/vision/v3.2/read/analyze")

    # -------------------------------------------------------------
    # 3. Azure Provider Network Polling & Mapping Tests
    # -------------------------------------------------------------
    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    @patch("requests.post")
    def test_azure_provider_unauthorized(self, mock_post):
        # Mock 401 Unauthorized from Azure submission
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Access denied due to invalid subscription key"
        mock_post.return_value = mock_response

        provider = AzureProvider()
        with self.assertRaises(AzureProviderError) as context:
            provider.recognize(self.mock_image)
        self.assertIn("API Authentication failed", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    @patch("requests.post")
    def test_azure_provider_server_error(self, mock_post):
        # Mock 500 Internal Server Error
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response

        provider = AzureProvider()
        with self.assertRaises(AzureProviderError) as context:
            provider.recognize(self.mock_image)
        self.assertIn("submission failed with HTTP status 500", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    @patch("requests.post")
    def test_azure_provider_missing_operation_location(self, mock_post):
        # Mock 202 Accepted but missing the Header
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = {}
        mock_post.return_value = mock_response

        provider = AzureProvider()
        with self.assertRaises(AzureProviderError) as context:
            provider.recognize(self.mock_image)
        self.assertIn("did not contain 'Operation-Location'", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    @patch("requests.post")
    @patch("requests.get")
    def test_azure_provider_polling_timeout(self, mock_get, mock_post):
        # Mock successful submission
        mock_submit = MagicMock()
        mock_submit.status_code = 202
        mock_submit.headers = {"Operation-Location": "https://mock.operation.url"}
        mock_post.return_value = mock_submit

        # Mock continuous running state
        mock_poll = MagicMock()
        mock_poll.status_code = 200
        mock_poll.json.return_value = {"status": "running"}
        mock_get.return_value = mock_poll

        provider = AzureProvider()
        # Set a very low provider timeout to trigger the timeout check
        provider.timeout = 0.05
        
        with self.assertRaises(AzureProviderError) as context:
            provider.recognize(self.mock_image)
        self.assertIn("exceeded total timeout limit", str(context.exception))

    @patch("app.config.settings.AZURE_ENDPOINT", "https://mock.cognitiveservices.azure.com")
    @patch("app.config.settings.AZURE_API_KEY", "secret-key")
    @patch("requests.post")
    @patch("requests.get")
    def test_azure_provider_polling_success(self, mock_get, mock_post):
        # Mock submit
        mock_submit = MagicMock()
        mock_submit.status_code = 202
        mock_submit.headers = {"Operation-Location": "https://mock.operation.url"}
        mock_post.return_value = mock_submit

        # Mock successful polling outcome
        mock_poll = MagicMock()
        mock_poll.status_code = 200
        mock_poll.json.return_value = {
            "status": "succeeded",
            "analyzeResult": {
                "readResults": [
                    {
                        "lines": [
                            {
                                "text": "Hello World",
                                "confidence": 0.98
                            },
                            {
                                "text": "Azure Read API Test",
                                "words": [{"text": "Azure", "confidence": 0.90}, {"text": "Test", "confidence": 0.94}]
                            }
                        ]
                    }
                ]
            }
        }
        mock_get.return_value = mock_poll

        provider = AzureProvider()
        result = provider.recognize(self.mock_image)
        
        self.assertEqual(result.provider, "azure")
        self.assertEqual(len(result.lines), 2)
        self.assertEqual(result.lines[0].text, "Hello World")
        self.assertEqual(result.lines[0].confidence, 0.98)
        # Verify fallback average word confidence calculation (0.90 + 0.94)/2 = 0.92
        self.assertAlmostEqual(result.lines[1].confidence, 0.92)
        # Average overall confidence (0.98 + 0.92)/2 = 0.95
        self.assertAlmostEqual(result.confidence, 0.95)

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
        with self.assertRaises(HWRServiceError) as context:
            HandwritingRecognitionService.recognize_handwriting(self.mock_image)
        self.assertIn("Unsupported HWR provider", str(context.exception))

    def test_hwr_service_explicit_provider(self):
        # Override settings using parameters
        result = HandwritingRecognitionService.recognize_handwriting(self.mock_image, provider_name="mock")
        self.assertEqual(result.provider, "mock")

    def test_hwr_service_invalid_image(self):
        with self.assertRaises(HWRServiceError):
            HandwritingRecognitionService.recognize_handwriting(None)


if __name__ == "__main__":
    unittest.main()
