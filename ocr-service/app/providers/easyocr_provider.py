import time
import logging
import cv2
import numpy as np
from typing import List, Optional

from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image

logger = logging.getLogger("app.providers.easyocr_provider")

class EasyOCRProviderError(Exception):
    """Custom exception raised for errors within EasyOCR provider."""
    pass

_easyocr_reader = None

def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            logger.info("Initializing EasyOCR reader for English (en)...")
            _easyocr_reader = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            logger.error("Failed to initialize EasyOCR: %s", str(e), exc_info=True)
            raise EasyOCRProviderError(f"Failed to initialize EasyOCR reader: {str(e)}") from e
    return _easyocr_reader


class EasyOCRHWRProvider(IHWRProvider):
    """
    Offline Handwriting Recognition Provider using EasyOCR.
    """

    def __init__(self) -> None:
        pass

    def recognize(self, image: np.ndarray, page_num: int = 1) -> HWRResult:
        validate_image(image)
        start_time = time.time()

        try:
            reader = _get_easyocr_reader()
        except Exception as e:
            raise EasyOCRProviderError(f"EasyOCR is not available: {str(e)}") from e

        logger.info("Executing EasyOCR on page %d...", page_num)

        try:
            # detail=1 returns list of tuples: (bbox, text, prob)
            results = reader.readtext(image, detail=1)
        except Exception as e:
            logger.error("EasyOCR execution failed: %s", str(e), exc_info=True)
            raise EasyOCRProviderError(f"EasyOCR processing error: {str(e)}") from e

        if not results:
            logger.warning("EasyOCR completed but detected 0 text lines on page %d.", page_num)
            return HWRResult(
                text="",
                confidence=0.0,
                lines=[],
                provider="easyocr",
                execution_time=round(time.time() - start_time, 4),
            )

        lines: List[HWRLine] = []
        # Sort results top-to-bottom, left-to-right
        results.sort(key=lambda item: (item[0][0][1], item[0][0][0]))

        for bbox, text, prob in results:
            clean_text = text.strip()
            if not clean_text:
                continue
            # Convert bbox to [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            box = [[float(pt[0]), float(pt[1])] for pt in bbox]
            lines.append(HWRLine(
                text=clean_text,
                confidence=round(float(prob), 4),
                boundingBox=box
            ))

        full_text = " ".join(line.text for line in lines)
        overall_conf = (
            sum(line.confidence for line in lines) / len(lines)
            if lines else 0.0
        )

        return HWRResult(
            text=full_text,
            confidence=round(overall_conf, 4),
            lines=lines,
            provider="easyocr",
            execution_time=round(time.time() - start_time, 4),
        )
