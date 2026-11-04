import os
import sys
import unittest
import cv2
import numpy as np

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.config import settings
from app.providers.azure_provider import AzureProvider, AzureProviderError

class TestAzureIntegration(unittest.TestCase):
    """
    Live Integration Test for Azure AI Document Intelligence HWR Provider.
    Only runs if AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY are populated.
    """

    @unittest.skipIf(
        not (os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT") and os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")),
        "Azure Document Intelligence credentials missing. Skipping live integration test."
    )
    def test_live_azure_ocr(self):
        # 1. Read sample handwriting image
        sample_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__), 
                "..", 
                "sample_images", 
                "Handwritten page1.jpg"
            )
        )
        self.assertTrue(os.path.exists(sample_path), f"Sample image not found at {sample_path}")

        image = cv2.imread(sample_path)
        self.assertIsNotNone(image, "Failed to load sample image using cv2")

        # 2. Construct AzureProvider
        provider = AzureProvider()

        # 3. Request Live OCR
        try:
            result = provider.recognize(image, page_num=1)
            
            # 4. Verify outputs structure to ensure compatibility
            self.assertEqual(result.provider, "azure")
            self.assertGreater(len(result.lines), 0, "Azure OCR succeeded but returned empty lines.")
            self.assertGreater(result.confidence, 0.0, "Average confidence should be greater than 0.")
            self.assertIsInstance(result.text, str)
            self.assertTrue(len(result.text.strip()) > 0)
            
            # Print first 2 line snippets to logs for verification
            print(f"\n[INTEGRATION TEST] Succeeded. Live Azure OCR output: {result.text[:120]}...\n")
        except AzureProviderError as ape:
            self.fail(f"Azure OCR Endpoint returned ProviderError: {ape}")

if __name__ == "__main__":
    unittest.main()
