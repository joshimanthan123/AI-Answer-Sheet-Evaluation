import os
import sys
import unittest
import numpy as np
import io
import time
from typing import BinaryIO
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add ocr-service root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.preprocess_service import ImagePreprocessor, PreprocessConfig, PreprocessResult
from app.models.hwr_models import HWRResult, HWRLine

# Generate a small mock black square image representing a valid 100x100 PNG image
# This avoids needing actual local files during the run
import cv2

def create_mock_png() -> bytes:
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".png", img)
    return buffer.tobytes()

MOCK_PNG_BYTES = create_mock_png()


class TestOcrApi(unittest.TestCase):
    """
    Integration test suite testing FastAPI endpoints, middlewares, custom exception
    mappings, file uploads, payloads validations, and concurrent requests.
    """

    def setUp(self):
        self.client = TestClient(app)
        # Backup global settings values to prevent test bleed
        self._backup_provider = settings.HWR_PROVIDER
        self._backup_max_size = settings.OCR_MAX_UPLOAD_SIZE_MB
        self._backup_timeout = settings.OCR_REQUEST_TIMEOUT
        
    def tearDown(self):
        settings.HWR_PROVIDER = self._backup_provider
        settings.OCR_MAX_UPLOAD_SIZE_MB = self._backup_max_size
        settings.OCR_REQUEST_TIMEOUT = self._backup_timeout

    # -------------------------------------------------------------
    # 1. Health and Version Endpoints
    # -------------------------------------------------------------
    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        
        # Check standard envelope format wrapper
        self.assertTrue(json_data["success"])
        self.assertEqual(json_data["message"], "Service health diagnostics compiled.")
        self.assertIn("provider", json_data["data"])
        self.assertIn("uptime", json_data["data"])
        self.assertEqual(json_data["data"]["service"], "ocr-service")

    def test_version_endpoint(self):
        response = self.client.get("/version")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        
        self.assertTrue(json_data["success"])
        self.assertEqual(json_data["message"], "Service version details loaded.")
        self.assertEqual(json_data["data"]["version"], "1.0.0")
        self.assertIn("build", json_data["data"])

    # -------------------------------------------------------------
    # 2. Preprocess Endpoint validations
    # -------------------------------------------------------------
    def test_preprocess_success(self):
        files = {"file": ("mock.png", MOCK_PNG_BYTES, "image/png")}
        response = self.client.post("/api/v1/ocr/preprocess", files=files)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["success"])
        self.assertIn("original", data["data"])
        self.assertIn("processed", data["data"])
        self.assertIn("metadata", data["data"])
        self.assertEqual(data["data"]["metadata"]["original_size"], [100, 100])

    def test_preprocess_unsupported_mime(self):
        # image/gif is not in ALLOWED_IMAGE_TYPES in Settings config
        files = {"file": ("mock.gif", b"GIF89a...", "image/gif")}
        response = self.client.post("/api/v1/ocr/preprocess", files=files)
        
        self.assertEqual(response.status_code, 415)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "INVALID_IMAGE_TYPE")

    def test_preprocess_oversized_file(self):
        # Temporarily drop limit to 0MB to fail standard mock image
        settings.OCR_MAX_UPLOAD_SIZE_MB = 0
        
        files = {"file": ("mock.png", MOCK_PNG_BYTES, "image/png")}
        response = self.client.post("/api/v1/ocr/preprocess", files=files)
        
        self.assertEqual(response.status_code, 413)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "FILE_TOO_LARGE")

    def test_preprocess_corrupted_image(self):
        # Send raw invalid bytes pretending to be image/png
        files = {"file": ("mock.png", b"not-an-image-data-stream", "image/png")}
        response = self.client.post("/api/v1/ocr/preprocess", files=files)
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "CORRUPTED_IMAGE")

    def test_preprocess_empty_upload(self):
        files = {"file": ("mock.png", b"", "image/png")}
        response = self.client.post("/api/v1/ocr/preprocess", files=files)
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["error_code"], "EMPTY_UPLOAD")

    # -------------------------------------------------------------
    # 3. Recognition and Segmentation Endpoints
    # -------------------------------------------------------------
    def test_recognize_endpoint(self):
        # Recognise using MockProvider (returns default lines list)
        settings.HWR_PROVIDER = "mock"
        files = {"file": ("mock.png", MOCK_PNG_BYTES, "image/png")}
        response = self.client.post("/api/v1/ocr/recognize", files=files)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("lines", data["data"])
        self.assertEqual(data["data"]["provider"], "mock")

    def test_segment_endpoint_success(self):
        # Post a mock HWRResult JSON dictionary payload to /segment
        hwr_payload = {
            "text": "Transcribed lines",
            "confidence": 0.95,
            "lines": [
                {"text": "Q1. Marks: 10", "confidence": 0.98},
                {"text": "Answer body line details.", "confidence": 0.94}
            ],
            "provider": "mock",
            "execution_time": 0.05
        }
        
        response = self.client.post("/api/v1/ocr/segment", json=hwr_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]["answers"]), 1)
        self.assertEqual(data["data"]["answers"][0]["normalized_question_number"], "Q1")

    def test_segment_endpoint_validation_failures(self):
        # 1. Missing json payload
        response = self.client.post("/api/v1/ocr/segment", json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["data"]["error_code"], "VALIDATION_ERROR")
        
        # 2. Empty list of results
        response = self.client.post("/api/v1/ocr/segment", json=[])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["data"]["error_code"], "INVALID_PAYLOAD")

    # -------------------------------------------------------------
    # 4. Pipeline and Orchestrator Endpoints
    # -------------------------------------------------------------
    def test_pipeline_endpoint_success(self):
        settings.HWR_PROVIDER = "mock"
        files = {"file": ("mock.png", MOCK_PNG_BYTES, "image/png")}
        response = self.client.post("/api/v1/ocr/pipeline", files=files)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        payload = data["data"]
        
        self.assertIn("request_id", payload)
        self.assertIn("preprocessing_time", payload)
        self.assertIn("hwr_time", payload)
        self.assertIn("segmentation_time", payload)
        self.assertIn("total_execution_time", payload)
        
        # Metrics validation
        self.assertIn("metrics", payload)
        self.assertEqual(payload["metrics"]["total_pages"], 1)
        self.assertGreater(payload["metrics"]["total_lines"], 0)
        
        # Structured segmentation outcomes
        self.assertIn("preprocessing", payload)
        self.assertIn("recognition", payload)
        self.assertIn("segmentation", payload)

    # -------------------------------------------------------------
    # 5. Concurrent Requests Test (Thread safety Verification)
    # -------------------------------------------------------------
    def test_concurrent_requests(self):
        # We spawn 20 simultaneous threads query `/health` in parallel
        # This proves the stateless router remains thread-safe
        settings.HWR_PROVIDER = "mock"
        url = "/health"
        
        def hit_endpoint():
            return self.client.get(url)
            
        threads_count = 20
        with ThreadPoolExecutor(max_workers=threads_count) as executor:
            futures = [executor.submit(hit_endpoint) for _ in range(threads_count)]
            results = [f.result() for f in as_completed(futures)]
            
        for response in results:
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["success"])


if __name__ == "__main__":
    unittest.main()
