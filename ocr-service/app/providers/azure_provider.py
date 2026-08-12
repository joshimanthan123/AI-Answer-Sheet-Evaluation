import time
import logging
import cv2
import numpy as np
from typing import Any, List, Optional

from app.providers.base_provider import IHWRProvider
from app.models.hwr_models import HWRLine, HWRResult
from app.utils.image_utils import validate_image
from app.config import settings

logger = logging.getLogger("app.providers.azure_provider")


class AzureProviderError(Exception):
    """Custom exception class for errors arising within the Azure Document Intelligence integration."""
    pass


def _build_client(endpoint: str, key: str):
    """
    Lazily import and construct a DocumentIntelligenceClient.

    The Azure SDK is imported inside this function (not at module import time)
    so the rest of the HWR architecture -- including MockProvider and the unit
    test suite -- keeps working even when 'azure-ai-documentintelligence' is not
    installed. Unit tests patch this function so no real SDK/network is used.
    """
    try:
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.core.credentials import AzureKeyCredential
    except ImportError as exc:
        raise AzureProviderError(
            "The 'azure-ai-documentintelligence' package is not installed. "
            "Install it with: pip install azure-ai-documentintelligence"
        ) from exc

    return DocumentIntelligenceClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key),
    )


class AzureProvider(IHWRProvider):
    """
    Handwriting Recognition provider backed by Azure AI Document Intelligence
    (prebuilt-read model). Converts a preprocessed OpenCV/numpy image to PNG
    bytes, submits it for analysis, waits for completion, and maps the returned
    pages/lines/words into the project's standard HWRResult model.

    The prebuilt-read model extracts both printed and handwritten text and
    returns lines, words, and per-word confidence values.
    """

    def __init__(self) -> None:
        # Prefer the Document Intelligence settings; fall back to the legacy
        # AZURE_ENDPOINT / AZURE_API_KEY values for backward compatibility.
        self.endpoint = (
            settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or settings.AZURE_ENDPOINT
        )
        self.key = settings.AZURE_DOCUMENT_INTELLIGENCE_KEY or settings.AZURE_API_KEY
        self.model = settings.AZURE_DOCUMENT_INTELLIGENCE_MODEL or "prebuilt-read"
        self.timeout = settings.AZURE_TIMEOUT

        if not self.endpoint:
            raise AzureProviderError(
                "Azure Document Intelligence is enabled but endpoint is not configured. "
                "Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT."
            )
        if not self.key:
            raise AzureProviderError(
                "Azure Document Intelligence is enabled but key is not configured. "
                "Set AZURE_DOCUMENT_INTELLIGENCE_KEY."
            )

    def recognize(self, image: np.ndarray, page_num: int = 1) -> HWRResult:
        """
        Recognize handwriting/text on a single preprocessed page image.

        Args:
            image: Preprocessed OpenCV/numpy image (already produced by the
                existing preprocessing stage; the original is never modified).
            page_num: 1-based page number, preserved for logging/context.

        Returns:
            HWRResult with real Azure-recognized text, lines and confidence.
        """
        validate_image(image)
        start_time = time.time()

        # 1. Encode the already-preprocessed numpy image to PNG bytes in-memory.
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise AzureProviderError("Failed to encode image array into PNG binary format.")
        image_bytes = encoded.tobytes()

        logger.info(
            "Submitting page %d to Azure Document Intelligence (model=%s)...",
            page_num, self.model,
        )

        # 2. Submit to Azure and wait for the long-running analysis to complete.
        client = _build_client(self.endpoint, self.key)
        try:
            poller = client.begin_analyze_document(
                model_id=self.model,
                body=image_bytes,
                content_type="application/octet-stream",
            )
            result = poller.result()
        except AzureProviderError:
            raise
        except Exception as exc:  # normalize all SDK/core errors, never leak the key
            raise self._map_sdk_error(exc) from exc
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                try:
                    close()
                except Exception:  # best-effort cleanup only
                    pass

        hwr = self._map_analyze_result(result, start_time, page_num)
        logger.info(
            "Azure recognition for page %d completed: %d line(s), avg confidence %.4f",
            page_num, len(hwr.lines), hwr.confidence,
        )
        return hwr

    def _map_analyze_result(self, result: Any, start_time: float, page_num: int) -> HWRResult:
        """
        Convert an Azure ``AnalyzeResult`` into the project HWRResult model.

        Line text comes directly from Azure ``line.content`` (never rewritten).
        Line confidence is the mean confidence of the Azure words whose text
        span falls inside the line's span(s).

        Documented confidence fallback: when a line has no word-level confidence
        available, the mean word confidence of that page is used; if the page
        has no words at all, 0.0 is recorded and a warning is logged. No fixed
        placeholder value is ever fabricated.

        Lines are emitted in Azure reading order (top-to-bottom). They are never
        sorted or concatenated, because AnswerSegmentationService relies on the
        original line ordering to detect question boundaries.
        """
        lines: List[HWRLine] = []
        try:
            pages = getattr(result, "pages", None) or []
            for page in pages:
                page_words = list(getattr(page, "words", None) or [])
                page_word_confs = [
                    float(w.confidence) for w in page_words
                    if getattr(w, "confidence", None) is not None
                ]
                page_mean = (
                    sum(page_word_confs) / len(page_word_confs)
                    if page_word_confs else None
                )

                for line in (getattr(page, "lines", None) or []):
                    text = getattr(line, "content", "") or ""
                    conf = self._line_confidence(line, page_words)
                    if conf is None:
                        conf = page_mean
                    if conf is None:
                        logger.warning(
                            "No word confidence available for a line on page %d; "
                            "recording confidence 0.0", page_num,
                        )
                        conf = 0.0
                    lines.append(HWRLine(text=text, confidence=round(float(conf), 4)))
        except AzureProviderError:
            raise
        except Exception as exc:
            raise AzureProviderError(
                f"Malformed or unexpected Azure Document Intelligence result: {exc}"
            ) from exc

        if not lines:
            logger.warning("Azure recognition succeeded but detected 0 lines of text.")

        full_text = "\n".join(line.text for line in lines)
        overall = sum(line.confidence for line in lines) / len(lines) if lines else 0.0

        return HWRResult(
            text=full_text,
            confidence=round(overall, 4),
            lines=lines,
            provider="azure",
            execution_time=round(time.time() - start_time, 4),
        )

    @staticmethod
    def _line_confidence(line: Any, page_words: List[Any]) -> Optional[float]:
        """Mean confidence of the words whose span lies within the line's span(s)."""
        spans = getattr(line, "spans", None)
        if not spans or not page_words:
            return None

        ranges = []
        for s in spans:
            offset = getattr(s, "offset", None)
            length = getattr(s, "length", None)
            if offset is None or length is None:
                continue
            ranges.append((offset, offset + length))
        if not ranges:
            return None

        confs: List[float] = []
        for w in page_words:
            span = getattr(w, "span", None)
            conf = getattr(w, "confidence", None)
            offset = getattr(span, "offset", None) if span is not None else None
            if offset is None or conf is None:
                continue
            if any(start <= offset < end for start, end in ranges):
                confs.append(float(conf))

        if not confs:
            return None
        return sum(confs) / len(confs)

    @staticmethod
    def _map_sdk_error(exc: Exception) -> "AzureProviderError":
        """
        Normalize Azure SDK/core exceptions into AzureProviderError without
        leaking the API key. Exceptions are matched by class name so this module
        never needs azure.core imported at load time (keeping the mock path and
        tests importable without the SDK installed).
        """
        name = type(exc).__name__
        status = getattr(exc, "status_code", None)

        if name == "ClientAuthenticationError" or status == 401:
            return AzureProviderError(
                "Azure authentication failed (401). Verify the configured endpoint and key."
            )
        if status == 429 or name == "TooManyRequests":
            return AzureProviderError("Azure request was rate limited (429). Please retry later.")
        if name in ("ServiceRequestError", "ServiceResponseError"):
            return AzureProviderError(f"Network error while contacting Azure: {exc}")
        if name == "ResourceNotFoundError" or status == 404:
            return AzureProviderError(
                "Azure resource or model not found (404). Verify the endpoint and model id."
            )
        if name == "HttpResponseError":
            return AzureProviderError(f"Azure service returned an error: {exc}")
        return AzureProviderError(f"Unexpected Azure Document Intelligence error: {exc}")

