import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

logger = logging.getLogger("app.services.ocr_quality_gate")

@dataclass
class QualityGateConfig:
    min_confidence: float = 0.60
    medium_confidence: float = 0.85
    min_text_length: int = 2
    min_alpha_ratio: float = 0.40
    max_repeated_char_ratio: float = 0.35

@dataclass
class QualityGateResult:
    confidence: float
    ocrQualityStatus: str  # "HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"
    needsReview: bool
    qualityReasons: List[str] = field(default_factory=list)

class OCRQualityGate:
    """
    Evaluates raw handwriting recognition outputs against quality, confidence,
    alphabetic ratio, and structural metrics. Does NOT alter recognized text.
    """
    def __init__(self, config: Optional[QualityGateConfig] = None):
        self.config = config or QualityGateConfig()

    def evaluate(self, text: str, confidence: float, lines: Optional[List[Any]] = None) -> QualityGateResult:
        reasons = []
        raw_text = (text or "").strip()
        
        # 1. Text Length Check
        if len(raw_text) < self.config.min_text_length:
            reasons.append(f"Recognized text length ({len(raw_text)}) below minimum threshold ({self.config.min_text_length})")

        # 2. Alphabetic / Numeric Character Ratio Check
        total_chars = len(raw_text)
        if total_chars > 0:
            alnum_chars = sum(1 for c in raw_text if c.isalnum() or c.isspace())
            alpha_ratio = alnum_chars / total_chars
            if alpha_ratio < self.config.min_alpha_ratio:
                reasons.append(f"Alphabetic ratio ({alpha_ratio:.2f}) below threshold ({self.config.min_alpha_ratio:.2f})")
                
            # Check for excessive repeated random characters
            char_counts = {}
            for c in raw_text:
                if not c.isspace():
                    char_counts[c] = char_counts.get(c, 0) + 1
            max_char_count = max(char_counts.values()) if char_counts else 0
            if max_char_count / max(total_chars, 1) > self.config.max_repeated_char_ratio and total_chars > 5:
                reasons.append("High ratio of repeated characters detected (potential OCR artifacting)")
        else:
            reasons.append("Empty text recognized from image")

        # 3. Confidence Classification
        status = "HIGH"
        needs_review = False

        if confidence < self.config.min_confidence or reasons:
            status = "NEEDS_REVIEW"
            needs_review = True
            if confidence < self.config.min_confidence:
                reasons.append(f"OCR confidence ({confidence:.2f}) below minimum threshold ({self.config.min_confidence:.2f})")
        elif confidence < self.config.medium_confidence:
            status = "MEDIUM"
            needs_review = False
        else:
            status = "HIGH"
            needs_review = False

        # If any quality check failed, mark as NEEDS_REVIEW
        if reasons and status != "NEEDS_REVIEW":
            status = "NEEDS_REVIEW"
            needs_review = True

        logger.info(
            "OCR Quality Gate evaluated text (len=%d, conf=%.2f) -> Status: %s, NeedsReview: %s, Reasons: %s",
            len(raw_text), confidence, status, needs_review, reasons
        )

        return QualityGateResult(
            confidence=round(confidence, 4),
            ocrQualityStatus=status,
            needsReview=needs_review,
            qualityReasons=reasons
        )

# Module singleton instance
quality_gate = OCRQualityGate()
