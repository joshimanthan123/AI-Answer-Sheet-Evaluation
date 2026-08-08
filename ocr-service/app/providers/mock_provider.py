import time
import random
import numpy as np
from typing import List
from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image

class MockProvider(IHWRProvider):
    """
    Offline Handwriting Recognition Provider.
    Simulates remote cloud API analysis times and returns deterministic mock output
    representing typical student answer sheets.
    """
    
    def recognize(self, image: np.ndarray) -> HWRResult:
        """
        Transcribes handwriting from the input image (simulated).
        
        Args:
            image: Preprocessed image.
            
        Returns:
            HWRResult: Mock structured transcription result containing specific text.
        """
        # 1. Validate the input image array using utility functions
        validate_image(image)
        
        # 2. Track execution time and mock delay (50 - 100ms)
        start_time = time.time()
        delay = random.uniform(0.05, 0.10)
        time.sleep(delay)
        
        # 3. Formulate deterministic line outputs
        lines = [
            HWRLine(text="Q1.", confidence=1.00),
            HWRLine(text="", confidence=1.00),
            HWRLine(text="Artificial Intelligence is the simulation", confidence=0.96),
            HWRLine(text="of human intelligence performed by machines.", confidence=0.94),
            HWRLine(text="", confidence=1.00),
            HWRLine(text="Q2.", confidence=1.00),
            HWRLine(text="", confidence=1.00),
            HWRLine(text="Machine Learning is a subset of AI.", confidence=0.95),
        ]
        
        # Reconstruct complete text block
        text_lines = [line.text for line in lines]
        full_text = "\n".join(text_lines)
        
        # 4. Compute average confidence
        total_conf = sum(line.confidence for line in lines)
        avg_confidence = total_conf / len(lines) if lines else 0.0
        
        elapsed_time = time.time() - start_time
        
        return HWRResult(
            text=full_text,
            confidence=round(avg_confidence, 4),
            lines=lines,
            provider="mock",
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

