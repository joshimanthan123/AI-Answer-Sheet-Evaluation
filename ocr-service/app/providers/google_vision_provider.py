import os
import time
import logging
import cv2
import numpy as np
from typing import Any, List, Optional

from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image
from app.config import settings

logger = logging.getLogger("app.providers.google_vision_provider")


class GoogleVisionProviderError(Exception):
    """Custom exception raised for errors within the Google Cloud Vision provider."""
    pass


def _build_client():
    """
    Lazily import and construct vision.ImageAnnotatorClient.
    
    The Google Cloud Vision SDK is imported inside this function
    so that unit tests can mock it without requiring the SDK to be
    installed / initialized at module load time.
    """
    try:
        from google.cloud import vision
    except ImportError as exc:
        raise GoogleVisionProviderError(
            "The 'google-cloud-vision' package is not installed. "
            "Install it with: pip install google-cloud-vision"
        ) from exc
    
    try:
        return vision.ImageAnnotatorClient()
    except Exception as exc:
        raise GoogleVisionProviderError(
            f"Failed to initialize Google Vision ImageAnnotatorClient: {str(exc)}"
        ) from exc


class GoogleVisionHWRProvider(IHWRProvider):
    """
    Handwriting Recognition provider backed by Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
    Converts a preprocessed OpenCV/numpy image to PNG bytes, submits it for analysis,
    and maps the returned page paragraphs/words into the project's standard HWRResult model.
    """

    def __init__(self) -> None:
        self.project_id = settings.GOOGLE_CLOUD_PROJECT_ID
        self.language_hint = settings.GOOGLE_VISION_LANGUAGE_HINT
        self.timeout = settings.GOOGLE_VISION_TIMEOUT_SECONDS

        # Validate that GOOGLE_APPLICATION_CREDENTIALS points to an existing file if configured
        creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
        if creds_path:
            if not os.path.exists(creds_path):
                raise GoogleVisionProviderError(
                    f"GOOGLE_APPLICATION_CREDENTIALS file not found at: {creds_path}"
                )

    def recognize(self, image: np.ndarray, page_num: int = 1) -> HWRResult:
        """
        Recognize handwriting/text on a single preprocessed page image.

        Args:
            image: Preprocessed OpenCV/numpy image array.
            page_num: 1-based page number, preserved for logging/context.

        Returns:
            HWRResult with Google-recognized text, lines, and confidence.
        """
        validate_image(image)
        start_time = time.time()

        # 1. Encode the preprocessed numpy image into PNG bytes in-memory
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise GoogleVisionProviderError("Failed to encode image array into PNG binary format.")
        image_content = encoded.tobytes()

        logger.info(
            "Submitting page %d to Google Cloud Vision (DOCUMENT_TEXT_DETECTION)...",
            page_num
        )

        client = _build_client()
        
        try:
            from google.cloud import vision
            
            google_image = vision.Image(content=image_content)
            
            # Configure language hints if provided
            image_context = None
            if self.language_hint:
                image_context = vision.ImageContext(
                    language_hints=[self.language_hint]
                )
            
            # Call document_text_detection (DOCUMENT_TEXT_DETECTION)
            response = client.document_text_detection(
                image=google_image,
                image_context=image_context,
                timeout=self.timeout
            )
            
        except GoogleVisionProviderError:
            raise
        except Exception as exc:
            raise self._map_sdk_error(exc) from exc

        # Handle API response errors
        if response.error and response.error.message:
            raise GoogleVisionProviderError(
                f"Google Cloud Vision API returned an error: {response.error.message}"
            )

        hwr = self._map_annotation_result(response, start_time, page_num)
        
        logger.info(
            "Google Cloud Vision recognition for page %d completed: %d line(s), avg confidence %.4f",
            page_num, len(hwr.lines), hwr.confidence
        )
        return hwr

    def _map_annotation_result(self, response: Any, start_time: float, page_num: int) -> HWRResult:
        """
        Convert Google Cloud Vision response into the project HWRResult model.
        
        Iterate through the full text annotation's structure: pages -> blocks -> paragraphs -> words.
        Reconstruct lines based on Google's detected paragraph & line breaks, calculating average
        confidence per line.
        """
        lines: List[HWRLine] = []
        full_text_annotation = getattr(response, "full_text_annotation", None)
        
        if not full_text_annotation or not full_text_annotation.pages:
            logger.warning("Google Cloud Vision completed but detected 0 pages/lines.")
            return HWRResult(
                text="",
                confidence=0.0,
                lines=[],
                provider="google_vision",
                execution_time=round(time.time() - start_time, 4)
            )

        try:
            for page in full_text_annotation.pages:
                for block in page.blocks:
                    for paragraph in block.paragraphs:
                        current_line_words = []
                        for word in paragraph.words:
                            word_text = "".join(symbol.text for symbol in word.symbols)
                            word_conf = getattr(word, "confidence", None)
                            if word_conf is None:
                                word_conf = 1.0  # Fallback if no word level confidence exists
                            
                            current_line_words.append((word_text, float(word_conf)))
                            
                            # Check for line break at the end of the word
                            is_line_break = False
                            if word.symbols:
                                last_symbol = word.symbols[-1]
                                if last_symbol.property and last_symbol.property.detected_break:
                                    break_type = last_symbol.property.detected_break.type_
                                    type_val = getattr(break_type, "value", break_type)
                                    # LINE_BREAK = 5, EOL_SURE_SPACE = 3
                                    if type_val in (3, 5):
                                        is_line_break = True
                                    else:
                                        type_name = str(break_type)
                                        if "LINE_BREAK" in type_name or "EOL_SURE_SPACE" in type_name:
                                            is_line_break = True
                            
                            if is_line_break:
                                line_text = " ".join([w[0] for w in current_line_words])
                                line_conf = sum([w[1] for w in current_line_words]) / len(current_line_words)
                                lines.append(HWRLine(text=line_text, confidence=round(line_conf, 4)))
                                current_line_words = []
                        
                        # Flush remainder of paragraph
                        if current_line_words:
                            line_text = " ".join([w[0] for w in current_line_words])
                            line_conf = sum([w[1] for w in current_line_words]) / len(current_line_words)
                            lines.append(HWRLine(text=line_text, confidence=round(line_conf, 4)))
                            
        except Exception as exc:
            raise GoogleVisionProviderError(
                f"Malformed or unexpected Google Cloud Vision result layout: {str(exc)}"
            ) from exc

        full_text = "\n".join(line.text for line in lines)
        overall_confidence = sum(line.confidence for line in lines) / len(lines) if lines else 0.0

        return HWRResult(
            text=full_text,
            confidence=round(overall_confidence, 4),
            lines=lines,
            provider="google_vision",
            execution_time=round(time.time() - start_time, 4)
        )

    @staticmethod
    def _map_sdk_error(exc: Exception) -> "GoogleVisionProviderError":
        """
        Normalize Google Cloud Vision SDK exceptions into GoogleVisionProviderError.
        """
        name = type(exc).__name__
        err_msg = str(exc)
        
        if "GoogleAuthError" in name or "DefaultCredentialsError" in name or "TransportError" in name:
            return GoogleVisionProviderError(f"Google authentication failed. Verify service account credentials. Details: {err_msg}")
        if "PermissionDenied" in name or "Forbidden" in name or "403" in err_msg:
            return GoogleVisionProviderError(f"Permission Denied: Google Vision API may not be enabled or service account lacks rights. Details: {err_msg}")
        if "DeadlineExceeded" in name or "Timeout" in name:
            return GoogleVisionProviderError(f"Google Cloud Vision API request timed out: {err_msg}")
        if "ResourceExhausted" in name or "Quota" in err_msg or "429" in err_msg:
            return GoogleVisionProviderError(f"Google Cloud Vision API quota or rate limit exceeded: {err_msg}")
        if "BadRequest" in name or "InvalidArgument" in name or "400" in err_msg:
            return GoogleVisionProviderError(f"Invalid request parameters or malformed image: {err_msg}")
        
        return GoogleVisionProviderError(f"Unexpected Google Cloud Vision API error: {err_msg}")
