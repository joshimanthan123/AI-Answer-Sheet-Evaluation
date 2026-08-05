import time
import logging
import cv2
import numpy as np
import requests
from typing import List, Tuple
from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image
from app.config import settings

logger = logging.getLogger("app.providers.azure_provider")


class AzureProviderError(Exception):
    """Custom exception class for errors arising within the Azure API integration."""
    pass


class AzureProvider(IHWRProvider):
    """
    Handwriting Recognition Provider using the Azure AI Vision (Read v3.2 API).
    Decoupled client that submits binary payloads, polls operation status,
    and converts the responses into the standardized HWRResult model.
    """
    
    def __init__(self) -> None:
        """
        Initializes the provider by validating required configuration parameters from config.py.
        """
        self.endpoint = settings.AZURE_ENDPOINT
        self.api_key = settings.AZURE_API_KEY
        self.timeout = settings.AZURE_TIMEOUT
        
        if not self.endpoint:
            raise AzureProviderError(
                "Azure endpoint is not configured. Provide AZURE_ENDPOINT environment value."
            )
        if not self.api_key:
            raise AzureProviderError(
                "Azure API key is not configured. Provide AZURE_API_KEY environment value."
            )
            
        # Format Read API path from base endpoint
        base = self.endpoint.rstrip("/")
        if "/vision/v" not in base:
            self.api_url = f"{base}/vision/v3.2/read/analyze"
        else:
            self.api_url = base

    def recognize(self, image: np.ndarray) -> HWRResult:
        """
        Submits preprocessed image to Azure Read API, queries job to completion,
        and standardizes output text.
        
        Args:
            image: NumPy array.
            
        Returns:
            HWRResult: Standardised output.
        """
        validate_image(image)
        start_time = time.time()
        
        # 1. Encode numpy image to jpeg bytes in-memory
        success, buffer = cv2.imencode(".jpg", image)
        if not success:
            raise AzureProviderError("Failed to encode image array into JPEG binary format.")
            
        image_bytes = buffer.tobytes()
        
        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "Content-Type": "application/octet-stream"
        }
        
        # 2. Submit initial POST analysis request
        logger.info("Submitting OCR analysis request to Azure Read API: %s", self.api_url)
        try:
            response = requests.post(
                self.api_url, 
                headers=headers, 
                data=image_bytes, 
                timeout=self.timeout
            )
        except requests.exceptions.RequestException as e:
            raise AzureProviderError(f"Network error during Azure submit POST request: {str(e)}") from e
            
        if response.status_code != 202:
            logger.error("Azure request submission failed. Status Code: %d, Response: %s", response.status_code, response.text)
            if response.status_code == 401:
                raise AzureProviderError("Azure API Authentication failed (401 Unauthorized). Verify AZURE_API_KEY.")
            raise AzureProviderError(f"Azure OCR submission failed with HTTP status {response.status_code}: {response.text}")
            
        # Extract Operation-Location URL from headers
        operation_url = response.headers.get("Operation-Location")
        if not operation_url:
            raise AzureProviderError("Azure API response did not contain 'Operation-Location' polling URL.")
            
        logger.info("Submission successful. Polling results from: %s", operation_url)
        
        # 3. Poll operation URL till result or timeout
        poll_headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }
        
        status = "notStarted"
        poll_start = time.time()
        poll_interval = 0.5 # start with rapid checks, scaling upward slowly
        ocr_data = None
        
        while status in ("notStarted", "running"):
            # Check for service level timeouts
            current_elapsed = time.time() - start_time
            if current_elapsed > self.timeout:
                raise AzureProviderError(f"Azure OCR recognition exceeded total timeout limit of {self.timeout}s.")
                
            try:
                poll_resp = requests.get(operation_url, headers=poll_headers, timeout=self.timeout)
            except requests.exceptions.RequestException as e:
                raise AzureProviderError(f"Network error during Azure polling: {str(e)}") from e
                
            if poll_resp.status_code != 200:
                raise AzureProviderError(f"Azure polling failed with HTTP status {poll_resp.status_code}: {poll_resp.text}")
                
            resp_json = poll_resp.json()
            status = resp_json.get("status", "failed")
            
            if status == "succeeded":
                ocr_data = resp_json
                break
            elif status == "failed":
                raise AzureProviderError("Azure Read OCR operation failed internally on the cloud service.")
                
            time.sleep(poll_interval)
            # Gentle backoff
            poll_interval = min(2.0, poll_interval * 1.5)
            
        if not ocr_data:
            raise AzureProviderError("Azure polling finished with succeeded status but no result payload.")
            
        # 4. Parse response values and compute stats
        lines = []
        try:
            analyze_result = ocr_data.get("analyzeResult", {})
            read_results = analyze_result.get("readResults", [])
            
            for page in read_results:
                page_lines = page.get("lines", [])
                for pline in page_lines:
                    text = pline.get("text", "")
                    
                    # Compute average word confidence as line confidence if missing
                    confidence = pline.get("confidence")
                    if confidence is None:
                        words = pline.get("words", [])
                        word_confs = [w.get("confidence", 1.0) for w in words]
                        confidence = sum(word_confs) / len(word_confs) if word_confs else 1.0
                        
                    lines.append(HWRLine(text=text, confidence=float(confidence)))
                    
        except Exception as e:
            raise AzureProviderError(f"Malformed or unexpected JSON structure from Azure response: {str(e)}") from e
            
        if not lines:
            logger.warning("Azure OCR succeeded but detected 0 lines of handwritten text.")
            
        full_text = "\n".join([line.text for line in lines])
        
        # Compute overall page confidence
        total_conf = sum(line.confidence for line in lines)
        avg_confidence = total_conf / len(lines) if lines else 1.0
        
        elapsed = time.time() - start_time
        
        return HWRResult(
            text=full_text,
            confidence=round(avg_confidence, 4),
            lines=lines,
            provider="azure",
            execution_time=round(elapsed, 4)
        )
