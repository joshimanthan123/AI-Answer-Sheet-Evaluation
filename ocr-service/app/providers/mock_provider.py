import time
import random
import logging
import numpy as np
from typing import List, Optional
from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image

logger = logging.getLogger("app.providers.mock_provider")

class MockProvider(IHWRProvider):
    """
    Offline Handwriting Recognition Provider with real OCR text extraction fallback.
    Tries EasyOCR or raw PDF text extraction first to return authentic text from uploaded documents.
    """
    
    def recognize(self, image: np.ndarray, page_num: int = 1, raw_text: Optional[str] = None) -> HWRResult:
        """
        Transcribes handwriting from the input image or uses raw extracted PDF text.
        """
        validate_image(image)
        start_time = time.time()
        
        lines: List[HWRLine] = []

        # 1. Try EasyOCR engine first to transcribe actual visual text from document image
        try:
            from app.providers.easyocr_provider import _get_easyocr_reader
            reader = _get_easyocr_reader()
            results = reader.readtext(image, detail=1)
            if results:
                results.sort(key=lambda item: (item[0][0][1], item[0][0][0]))
                for bbox, text, prob in results:
                    clean_text = text.strip()
                    if clean_text:
                        box = [[float(pt[0]), float(pt[1])] for pt in bbox]
                        lines.append(HWRLine(
                            text=clean_text,
                            confidence=round(float(prob), 4),
                            boundingBox=box
                        ))
        except Exception as e:
            logger.warning("MockProvider EasyOCR real text extraction skipped: %s", str(e))

        # 2. Try raw_text (from PDF text layer) if EasyOCR detected 0 visual text lines
        if not lines and raw_text and raw_text.strip():
            raw_lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
            for line_str in raw_lines:
                lines.append(HWRLine(text=line_str, confidence=0.95))

        # 3. If no text could be extracted by EasyOCR or PyMuPDF, report no text detected
        if not lines:
            lines = [
                HWRLine(text=f"Q{page_num}.", confidence=1.00),
                HWRLine(text=f"[No handwritten or typed text detected on page {page_num}]", confidence=0.50)
            ]
        
        # Reconstruct complete text block
        text_lines = [line.text for line in lines if line.text]
        full_text = "\n".join(text_lines)
        
        # Compute average confidence
        total_conf = sum(line.confidence for line in lines)
        avg_confidence = total_conf / len(lines) if lines else 0.0
        
        elapsed_time = time.time() - start_time
        
        return HWRResult(
            text=full_text,
            confidence=round(avg_confidence, 4),
            lines=lines,
            provider="easyocr" if lines and lines[0].boundingBox else "mock",
            execution_time=round(elapsed_time, 4)
        )


import json
from app.providers.base_provider import ILLMProvider
from app.models.llm_models import LLMRequest, LLMResponse, ProviderHealthResponse

class MockLLMProvider(ILLMProvider):
    """
    Mock LLM Provider for offline local testing and development.
    Requires no API credentials or internet connections.
    """
    async def generate(self, request: LLMRequest) -> LLMResponse:
        mock_data = {
            "marks": 4,
            "feedback": "The answer correctly explains the main concepts but misses one important point.",
            "missing_points": [
                "Important concept"
            ],
            "strengths": [
                "Correct definition",
                "Good explanation"
            ],
            "confidence": 0.92
        }
        return LLMResponse(
            content=json.dumps(mock_data),
            provider="mock",
            model="mock-model",
            finish_reason="stop",
            input_tokens=15,
            output_tokens=35,
            total_tokens=50,
            latency_ms=5.0
        )

    async def health_check(self) -> ProviderHealthResponse:
        return ProviderHealthResponse(
            provider="mock",
            available=True,
            model="mock-model",
            message="Mock LLM provider is online and healthy."
        )

