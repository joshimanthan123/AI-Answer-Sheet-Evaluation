import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.hwr_models import HWRResult
from app.providers.azure_provider import AzureProvider, AzureProviderError

try:
    from tests.azure_fakes import make_analyze_result, make_poller, make_line
except ImportError:  # when discovered with tests/ as top-level dir
    from azure_fakes import make_analyze_result, make_poller, make_line


ENDPOINT = "https://mock.cognitiveservices.azure.com"


def _azure_settings(fn):
    """Stack the settings patches needed to construct a valid AzureProvider."""
    fn = patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", ENDPOINT)(fn)
    fn = patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key")(fn)
    fn = patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_MODEL", "prebuilt-read")(fn)
    return fn


class TestAzureProvider(unittest.TestCase):
    def setUp(self):
        self.image = np.ones((80, 120), dtype=np.uint8) * 255

    # 1. Configuration missing --------------------------------------------
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_ENDPOINT", None)
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "k")
    def test_missing_endpoint_raises(self):
        with self.assertRaises(AzureProviderError):
            AzureProvider()

    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", ENDPOINT)
    @patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", None)
    @patch("app.config.settings.AZURE_API_KEY", None)
    def test_missing_key_raises(self):
        with self.assertRaises(AzureProviderError):
            AzureProvider()

    # 2. Initialization ---------------------------------------------------
    @_azure_settings
    def test_initialization(self):
        provider = AzureProvider()
        self.assertEqual(provider.endpoint, ENDPOINT)
        self.assertEqual(provider.model, "prebuilt-read")

    # 3. numpy -> PNG bytes + analyze called with PNG payload -------------
    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_numpy_encoded_to_png(self, mock_build_client):
        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(
            make_analyze_result([("text", [("text", 0.9, 0, 4)])])
        )
        mock_build_client.return_value = client

        AzureProvider().recognize(self.image)

        _, kwargs = client.begin_analyze_document.call_args
        body = kwargs.get("body")
        self.assertIsInstance(body, (bytes, bytearray))
        # PNG magic number.
        self.assertEqual(bytes(body[:8]), b"\x89PNG\r\n\x1a\n")

    # 4/5. result -> HWRResult / lines -> HWRLine --------------------------
    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_result_mapped_to_hwrresult(self, mock_build_client):
        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(
            make_analyze_result([
                ("First line", [("First", 0.80, 0, 5), ("line", 0.90, 6, 4)]),
                ("Second", [("Second", 1.00, 11, 6)]),
            ])
        )
        mock_build_client.return_value = client

        hwr = AzureProvider().recognize(self.image)
        self.assertIsInstance(hwr, HWRResult)
        self.assertEqual(hwr.provider, "azure")
        self.assertEqual(len(hwr.lines), 2)
        self.assertEqual(hwr.lines[0].text, "First line")
        self.assertAlmostEqual(hwr.lines[0].confidence, 0.85, places=4)
        self.assertAlmostEqual(hwr.lines[1].confidence, 1.00, places=4)

    # 6. Confidence fallback: line has no word confidence -> page mean -----
    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_confidence_fallback_to_page_mean(self, mock_build_client):
        # Second line's word offset (99) is outside its own line span coverage
        # is avoided; instead we give the second line no matching words at all by
        # placing its declared span away from any word. We simulate this by a
        # line whose words list on the page only covers the first line.
        result = make_analyze_result([
            ("Known", [("Known", 0.80, 0, 5)]),
        ])
        # Append a second line whose span matches no word (offset far away).
        result.pages[0].lines.append(make_line("Orphan", 500, 6))

        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(result)
        mock_build_client.return_value = client

        hwr = AzureProvider().recognize(self.image)
        self.assertEqual(len(hwr.lines), 2)
        # First line uses its own word confidence.
        self.assertAlmostEqual(hwr.lines[0].confidence, 0.80, places=4)
        # Orphan line falls back to the page mean word confidence (0.80 here),
        # never a fabricated fixed constant.
        self.assertAlmostEqual(hwr.lines[1].confidence, 0.80, places=4)

    # 7/8. provider="azure" + page_num propagation -------------------------
    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_provider_name_and_page_num(self, mock_build_client):
        client = MagicMock()
        client.begin_analyze_document.return_value = make_poller(
            make_analyze_result([("Q3.", [("Q3.", 0.97, 0, 3)])])
        )
        mock_build_client.return_value = client

        hwr = AzureProvider().recognize(self.image, page_num=3)
        self.assertEqual(hwr.provider, "azure")
        # One Azure analysis per page (spec: not per line, not repeated).
        client.begin_analyze_document.assert_called_once()

    # 9. Error handling ----------------------------------------------------
    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_auth_error_mapped(self, mock_build_client):
        class ClientAuthenticationError(Exception):
            status_code = 401

        client = MagicMock()
        client.begin_analyze_document.side_effect = ClientAuthenticationError("bad key")
        mock_build_client.return_value = client

        with self.assertRaises(AzureProviderError) as ctx:
            AzureProvider().recognize(self.image)
        self.assertIn("authentication failed", str(ctx.exception).lower())
        # Secret is never included in error output.
        self.assertNotIn("secret-key", str(ctx.exception))

    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_rate_limit_mapped(self, mock_build_client):
        class HttpResponseError(Exception):
            status_code = 429

        client = MagicMock()
        client.begin_analyze_document.side_effect = HttpResponseError("throttled")
        mock_build_client.return_value = client

        with self.assertRaises(AzureProviderError) as ctx:
            AzureProvider().recognize(self.image)
        self.assertIn("rate limited", str(ctx.exception).lower())

    @_azure_settings
    @patch("app.providers.azure_provider._build_client")
    def test_network_error_mapped(self, mock_build_client):
        class ServiceRequestError(Exception):
            pass

        client = MagicMock()
        client.begin_analyze_document.side_effect = ServiceRequestError("dns fail")
        mock_build_client.return_value = client

        with self.assertRaises(AzureProviderError) as ctx:
            AzureProvider().recognize(self.image)
        self.assertIn("network error", str(ctx.exception).lower())

    def test_invalid_image_raises(self):
        with patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", ENDPOINT), \
             patch("app.config.settings.AZURE_DOCUMENT_INTELLIGENCE_KEY", "secret-key"):
            provider = AzureProvider()
            with self.assertRaises(ValueError):
                provider.recognize(None)


if __name__ == "__main__":
    unittest.main()
