import os
import sys
import unittest
import cv2
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.config import settings
from app.providers.google_vision_provider import GoogleVisionHWRProvider, GoogleVisionProviderError

# Check if credentials file is present and exists
creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
creds_exist = False
if creds_path and os.path.exists(creds_path):
    creds_exist = True

class TestGoogleVisionIntegration(unittest.TestCase):
    """
    Live Integration Test for Google Cloud Vision HWR Provider.
    Only runs if GOOGLE_APPLICATION_CREDENTIALS points to an existing file.
    """

    @unittest.skipIf(
        not creds_exist,
        "Google Cloud Vision credentials file not found. Skipping live integration test."
    )
    def test_live_google_vision_ocr(self):
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

        # 2. Construct GoogleVisionHWRProvider
        try:
            provider = GoogleVisionHWRProvider()
        except GoogleVisionProviderError as gve:
            self.skipTest(f"Failed to initialize Google Vision: {gve}. Skipping.")

        # 3. Request Live OCR
        try:
            result = provider.recognize(image, page_num=1)
            
            # 4. Verify outputs structure to ensure compatibility
            self.assertEqual(result.provider, "google_vision")
            self.assertGreater(len(result.lines), 0, "Google Vision OCR succeeded but returned empty lines.")
            self.assertGreater(result.confidence, 0.0, "Average confidence should be greater than 0.")
            self.assertIsInstance(result.text, str)
            self.assertTrue(len(result.text.strip()) > 0)
            
            # Print success message without exposing key paths
            print(f"\n[INTEGRATION TEST] Succeeded. Live Google Vision OCR output snippet: {result.text[:120]}...\n")
        except GoogleVisionProviderError as gvpe:
            self.fail(f"Google Vision OCR returned ProviderError: {gvpe}")

if __name__ == "__main__":
    unittest.main()
