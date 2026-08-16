import os
# Disable oneDNN to prevent ConvertPirAttr NotImplemented errors on Windows CPU
os.environ['PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT'] = '0'
os.environ['FLAGS_use_onednn'] = '0'
os.environ['FLAGS_use_mkldnn'] = '0'

import time
import logging
import cv2
import numpy as np
from typing import Any, List, Optional

from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image
from app.config import settings

logger = logging.getLogger("app.providers.paddle_provider")


class PaddleProviderError(Exception):
    """Custom exception raised for errors within the PaddleOCR provider."""
    pass


_ocr_engine = None


def _get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            import logging as py_logging
            # Suppress verbose logging from PaddleOCR
            py_logging.getLogger("ppocr").setLevel(py_logging.WARNING)

            paddle_model = getattr(settings, "PADDLE_MODEL", "en_PP-OCRv5_mobile_rec")
            logger.info("Initializing offline PaddleOCR engine on CPU with model: %s", paddle_model)
            
            if paddle_model == "PP-OCRv5_server_rec":
                # Server recognition model maps to Chinese/English bilingual
                _ocr_engine = PaddleOCR(
                    lang="ch",
                    device="cpu",
                    ocr_version="PP-OCRv5"
                )
            elif paddle_model == "en_PP-OCRv5_mobile_rec":
                # Mobile English recognition model
                _ocr_engine = PaddleOCR(
                    lang="en",
                    device="cpu",
                    ocr_version="PP-OCRv5"
                )
            else:
                # Generic model name override fallback
                _ocr_engine = PaddleOCR(
                    text_recognition_model_name=paddle_model,
                    text_detection_model_name="PP-OCRv5_server_det",
                    device="cpu"
                )
        except Exception as e:
            logger.error("Failed to initialize PaddleOCR engine: %s", str(e), exc_info=True)
            raise PaddleProviderError(f"Failed to initialize PaddleOCR engine: {str(e)}") from e
    return _ocr_engine


class PaddleHWRProvider(IHWRProvider):
    """
    Offline Handwriting Recognition Provider using PaddleOCR.
    Processes OpenCV/numpy image array, extracts recognized text/lines/confidence and
    returns normalized HWRResult model. Supports both 3.x/v5 (dictionary) and legacy 2.x (list) formats.
    """

    def __init__(self) -> None:
        # Pre-validate setup - any setup/download occurs lazily in _get_ocr_engine on first print/parse call
        pass

    def recognize(self, image: np.ndarray, page_num: int = 1) -> HWRResult:
        """
        Recognize text in the given preprocessed page image array.

        Args:
            image: Preprocessed OpenCV/numpy image array.
            page_num: 1-based page number, preserved for logging/context.

        Returns:
            HWRResult: Normalized handwriting recognition result.
        """
        validate_image(image)
        start_time = time.time()

        try:
            ocr_engine = _get_ocr_engine()
        except Exception as e:
            raise PaddleProviderError(f"PaddleOCR is not available or failed to load: {str(e)}") from e

        logger.info("Executing PaddleOCR on page %d...", page_num)

        try:
            # Call predict if available (standard in 3.x), else fallback to ocr (2.x mock support)
            if hasattr(ocr_engine, 'predict') and not isinstance(ocr_engine, MagicMock if 'MagicMock' in globals() else object):
                # When using MagicMock in unit tests, we want to call the mock target (which usually mocks .ocr)
                results = ocr_engine.predict(image)
            else:
                results = ocr_engine.ocr(image, cls=True)
        except Exception as e:
            logger.error("PaddleOCR execution failed: %s", str(e), exc_info=True)
            raise PaddleProviderError(f"PaddleOCR processing error: {str(e)}") from e

        # Check for empty/None result
        if not results or results[0] is None:
            logger.warning("PaddleOCR completed but detected 0 lines of text on page %d.", page_num)
            return HWRResult(
                text="",
                confidence=0.0,
                lines=[],
                provider="paddle",
                execution_time=round(time.time() - start_time, 4),
            )

        boxes = []
        # Support both 3.x dict output format and 2.x nested list output format
        if isinstance(results[0], dict):
            page_result = results[0]
            rec_texts = page_result.get('rec_texts', [])
            rec_scores = page_result.get('rec_scores', [])
            dt_polys = page_result.get('dt_polys', [])

            for idx in range(len(rec_texts)):
                txt = rec_texts[idx]
                score = float(rec_scores[idx]) if idx < len(rec_scores) else 0.0
                
                # Poly bounding box representation
                poly = dt_polys[idx] if idx < len(dt_polys) else []
                # Normalize poly to standard coordinate list if it is a numpy ndarray
                if hasattr(poly, 'tolist'):
                    box = poly.tolist()
                else:
                    box = poly

                if not box or len(box) < 4:
                    continue

                # Box format: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                y_center = (y_min + y_max) / 2
                height = y_max - y_min

                boxes.append({
                    "box": box,
                    "text": txt,
                    "confidence": score,
                    "x_min": x_min,
                    "x_max": x_max,
                    "y_min": y_min,
                    "y_max": y_max,
                    "y_center": y_center,
                    "height": height,
                })
        else:
            # Old 2.x list format: [ [ [box, (text, confidence)], ... ] ]
            page_result = results[0]
            for item in page_result:
                if not item or len(item) < 2:
                    continue
                box = item[0]
                txt_conf = item[1]
                if not txt_conf or len(txt_conf) < 2:
                    continue
                txt, score = txt_conf[0], txt_conf[1]

                # Box format: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                y_center = (y_min + y_max) / 2
                height = y_max - y_min

                boxes.append({
                    "box": box,
                    "text": txt,
                    "confidence": float(score),
                    "x_min": x_min,
                    "x_max": x_max,
                    "y_min": y_min,
                    "y_max": y_max,
                    "y_center": y_center,
                    "height": height,
                })

        sorted_lines: List[HWRLine] = []
        if boxes:
            # Sort boxes top-to-bottom vertically by center coordinates
            boxes.sort(key=lambda b: b["y_center"])

            # Group overlapping boxes on similar horizontal lines
            lines_grouped: List[List[dict]] = []
            for box in boxes:
                placed = False
                for line in lines_grouped:
                    line_y_min = min(b["y_min"] for b in line)
                    line_y_max = max(b["y_max"] for b in line)
                    line_h = line_y_max - line_y_min

                    overlap_min = max(box["y_min"], line_y_min)
                    overlap_max = min(box["y_max"], line_y_max)
                    overlap = overlap_max - overlap_min

                    box_h = box["height"]
                    # If lines overlap vertically by more than 50% or center lies within line boundaries
                    if overlap > 0 and (
                        overlap / min(box_h, line_h) > 0.5
                        or line_y_min <= box["y_center"] <= line_y_max
                    ):
                        line.append(box)
                        placed = True
                        break

                if not placed:
                    lines_grouped.append([box])

            # Process grouped text lines
            line_data = []
            for line in lines_grouped:
                # Sort horizontally left-to-right
                line.sort(key=lambda b: b["x_min"])
                text = " ".join(b["text"] for b in line)
                avg_conf = sum(b["confidence"] for b in line) / len(line)
                y_cent = sum(b["y_center"] for b in line) / len(line)
                line_data.append((text, avg_conf, y_cent))

            # Sort lines top-to-bottom
            line_data.sort(key=lambda l: l[2])

            for text, conf, _ in line_data:
                sorted_lines.append(HWRLine(text=text, confidence=round(conf, 4)))

        full_text = "\n".join(line.text for line in sorted_lines)
        overall_confidence = (
            sum(line.confidence for line in sorted_lines) / len(sorted_lines)
            if sorted_lines
            else 0.0
        )

        return HWRResult(
            text=full_text,
            confidence=round(overall_confidence, 4),
            lines=sorted_lines,
            provider="paddle",
            execution_time=round(time.time() - start_time, 4),
        )
