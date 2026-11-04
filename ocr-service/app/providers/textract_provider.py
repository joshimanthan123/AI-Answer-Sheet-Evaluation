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

logger = logging.getLogger("app.providers.textract_provider")


class TextractProviderError(Exception):
    """Custom exception raised for errors within the Amazon Textract provider."""
    pass


def _build_client(region_name: str | None = None):
    """
    Lazily import boto3 and construct an Amazon Textract client.
    
    Reads AWS credentials through explicit settings/environment variables
    (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
    or falls through to the standard AWS credential chain (~/.aws/credentials, IAM roles).
    """
    try:
        import boto3
    except ImportError as exc:
        raise TextractProviderError(
            "The 'boto3' package is not installed. "
            "Install it with: pip install boto3"
        ) from exc

    try:
        region = region_name or getattr(settings, "AWS_REGION", "us-east-1")
        access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None) or os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None) or os.getenv("AWS_SECRET_ACCESS_KEY")
        session_token = getattr(settings, "AWS_SESSION_TOKEN", None) or os.getenv("AWS_SESSION_TOKEN")

        session_kwargs = {"region_name": region}
        if access_key and secret_key:
            session_kwargs["aws_access_key_id"] = access_key.strip()
            session_kwargs["aws_secret_access_key"] = secret_key.strip()
            if session_token:
                session_kwargs["aws_session_token"] = session_token.strip()

        session = boto3.Session(**session_kwargs)
        return session.client("textract", region_name=region)
    except Exception as exc:
        raise TextractProviderError(
            f"Failed to initialize AWS Textract client: {str(exc)}"
        ) from exc


class TextractHWRProvider(IHWRProvider):
    """
    Handwriting Recognition provider backed by Amazon Textract (DetectDocumentText).
    Converts a preprocessed OpenCV/numpy image array to supported JPEG/PNG bytes,
    submits it to Amazon Textract synchronous detect_document_text API, and maps
    detected LINE blocks into the project's normalized HWRResult model.
    """

    def __init__(self, region_name: str | None = None) -> None:
        self.region = region_name or getattr(settings, "AWS_REGION", "us-east-1")
        logger.info("Initializing TextractHWRProvider with AWS region: %s", self.region)

    def recognize(
        self,
        image: np.ndarray,
        page_num: int = 1,
        raw_text: Optional[str] = None
    ) -> HWRResult:
        """
        Recognize text/handwriting on a single preprocessed page image.

        Args:
            image: Preprocessed OpenCV/numpy image array.
            page_num: 1-based page number, preserved for logging/context.
            raw_text: Optional fallback raw text from PDF text layers.

        Returns:
            HWRResult with Textract-recognized lines, bounding boxes, and confidence.
        """
        validate_image(image)
        start_time = time.time()

        # 1. Prepare image bytes in supported format (JPEG or PNG) <= 5 MB
        image_bytes = self._prepare_image_bytes(image)

        logger.info(
            "Submitting page %d (%d bytes) to Amazon Textract (detect_document_text) in region %s...",
            page_num, len(image_bytes), self.region
        )

        client = _build_client(self.region)

        try:
            response = client.detect_document_text(
                Document={"Bytes": image_bytes}
            )
        except TextractProviderError:
            raise
        except Exception as exc:
            raise self._map_sdk_error(exc) from exc

        hwr = self._map_textract_result(response, start_time, page_num, image_shape=image.shape)
        logger.info(
            "Amazon Textract recognition for page %d completed: %d line(s), avg confidence %.4f",
            page_num, len(hwr.lines), hwr.confidence
        )
        return hwr

    def _prepare_image_bytes(self, image: np.ndarray) -> bytes:
        """
        Encodes the image array to PNG/JPEG bytes, ensuring it conforms to
        Amazon Textract's synchronous 5 MB document size limit without cropping.
        """
        max_bytes = 5 * 1024 * 1024  # 5 MB synchronous limit

        # First try encoding as PNG
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise TextractProviderError("Failed to encode image array into PNG format.")
        image_bytes = encoded.tobytes()

        if len(image_bytes) <= max_bytes:
            return image_bytes

        # If PNG exceeds 5 MB, encode to high-quality JPEG
        logger.info("Encoded PNG is %d bytes (> 5 MB). Compressing to JPEG...", len(image_bytes))
        success, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if success and len(encoded.tobytes()) <= max_bytes:
            return encoded.tobytes()

        # Try medium-quality JPEG
        success, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if success and len(encoded.tobytes()) <= max_bytes:
            return encoded.tobytes()

        # Proportional resize maintaining aspect ratio (never crop)
        h, w = image.shape[:2]
        scale = min(1.0, (max_bytes / len(image_bytes)) ** 0.5 * 0.95)
        new_w, new_h = max(int(w * scale), 200), max(int(h * scale), 200)
        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

        success, encoded = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if success and len(encoded.tobytes()) <= max_bytes:
            return encoded.tobytes()

        raise TextractProviderError(
            f"Image payload size ({len(image_bytes)} bytes) exceeds the Amazon Textract 5 MB synchronous limit."
        )

    def _map_textract_result(
        self,
        response: Any,
        start_time: float,
        page_num: int,
        image_shape: tuple
    ) -> HWRResult:
        """
        Converts Amazon Textract detect_document_text response into normalized HWRResult model.
        Extracts LINE blocks, normalizes confidence from 0-100 to 0.0-1.0, and converts
        normalized bounding boxes into pixel coordinates matching other providers.
        """
        lines: List[HWRLine] = []
        blocks = response.get("Blocks", []) if isinstance(response, dict) else getattr(response, "get", lambda k, d: [])("Blocks", [])

        img_h, img_w = image_shape[:2]

        for block in blocks:
            if block.get("BlockType") != "LINE":
                continue

            text = block.get("Text", "").strip()
            if not text:
                continue

            # Textract returns confidence as a percentage (0.0 to 100.0)
            raw_conf = block.get("Confidence", 0.0)
            confidence = round(float(raw_conf) / 100.0, 4)

            # Spatial coordinates conversion
            line_box = None
            geometry = block.get("Geometry", {})
            polygon = geometry.get("Polygon")
            bbox = geometry.get("BoundingBox")

            if polygon and len(polygon) >= 4:
                # 4-corner polygon in pixel coordinates: [[x, y], ...]
                line_box = [
                    [int(round(pt.get("X", 0.0) * img_w)), int(round(pt.get("Y", 0.0) * img_h))]
                    for pt in polygon
                ]
            elif bbox:
                left = int(round(bbox.get("Left", 0.0) * img_w))
                top = int(round(bbox.get("Top", 0.0) * img_h))
                width = int(round(bbox.get("Width", 0.0) * img_w))
                height = int(round(bbox.get("Height", 0.0) * img_h))
                line_box = [
                    [left, top],
                    [left + width, top],
                    [left + width, top + height],
                    [left, top + height]
                ]

            lines.append(HWRLine(
                text=text,
                confidence=confidence,
                boundingBox=line_box
            ))

        if not lines:
            logger.warning("Amazon Textract completed but detected 0 lines of text on page %d.", page_num)
            return HWRResult(
                text="",
                confidence=0.0,
                lines=[],
                provider="textract",
                execution_time=round(time.time() - start_time, 4)
            )

        full_text = "\n".join(line.text for line in lines)
        overall_confidence = round(sum(line.confidence for line in lines) / len(lines), 4)

        return HWRResult(
            text=full_text,
            confidence=overall_confidence,
            lines=lines,
            provider="textract",
            execution_time=round(time.time() - start_time, 4)
        )

    @staticmethod
    def _map_sdk_error(exc: Exception) -> "TextractProviderError":
        """
        Maps boto3/botocore exceptions to standardized TextractProviderError
        without logging or exposing sensitive credentials.
        """
        name = type(exc).__name__
        err_msg = str(exc)
        code = ""

        # Extract AWS Error Code and Message safely if available
        if hasattr(exc, "response") and isinstance(exc.response, dict):
            error_data = exc.response.get("Error", {})
            code = error_data.get("Code", "")
            err_msg = error_data.get("Message", err_msg)

        # 1. Expired session token
        if (
            code in ("ExpiredToken", "ExpiredTokenException")
            or "security token included in the request is expired" in err_msg.lower()
            or "session token has expired" in err_msg.lower()
        ):
            return TextractProviderError(
                "AWS session credentials have expired. Please refresh your temporary AWS credentials."
            )

        # 2. Access Denied / IAM permissions
        if (
            code in ("AccessDeniedException", "AccessDenied", "UnauthorizedOperation")
            or "accessdenied" in name.lower()
            or "not authorized to perform: textract" in err_msg.lower()
        ):
            return TextractProviderError(
                f"AWS Access Denied: Missing permissions for textract:DetectDocumentText. Details: {err_msg}"
            )

        # 3. Unsupported document format
        if (
            code in ("UnsupportedDocumentException", "InvalidParameterException")
            or "unsupported document format" in err_msg.lower()
        ):
            return TextractProviderError(
                f"Unsupported document format submitted to Amazon Textract: {err_msg}"
            )

        # 4. Oversized document
        if (
            code in ("DocumentTooLargeException", "ImageTooLargeException")
            or "document exceeds" in err_msg.lower()
            or "size too large" in err_msg.lower()
        ):
            return TextractProviderError(
                f"Document size exceeds Amazon Textract limits: {err_msg}"
            )

        # 5. Throttling and quota limits
        if code in ("ProvisionedThroughputExceededException", "LimitExceededException", "ThrottlingException"):
            return TextractProviderError(
                f"Amazon Textract request limit or throughput exceeded: {err_msg}"
            )

        # 6. Missing or invalid credentials or subscription
        if (
            code in ("SubscriptionRequiredException", "OptInRequired")
            or "subscription" in err_msg.lower()
        ):
            return TextractProviderError(
                f"AWS Textract subscription required: The provided AWS account is not subscribed to Textract or credentials do not match an active session. Details: {err_msg}"
            )

        if (
            code in ("InvalidSecurityToken", "UnrecognizedClientException", "AuthFailure", "MissingCredentialsError", "NoCredentialsError")
            or "unable to locate credentials" in err_msg.lower()
            or "no credentials" in err_msg.lower()
        ):
            return TextractProviderError(
                f"AWS authentication failed: Unable to locate valid AWS credentials. Details: {err_msg}"
            )

        # 7. Network timeouts and unreachable endpoint
        if (
            "EndpointConnectionError" in name
            or "ConnectTimeoutError" in name
            or "ReadTimeoutError" in name
            or "timeout" in err_msg.lower()
        ):
            return TextractProviderError(
                f"Network failure connecting to Amazon Textract endpoint: {err_msg}"
            )

        # 8. Generic BotoCore / AWS Client Error
        if "BotoCoreError" in name or "ClientError" in name:
            prefix = f" [{code}]" if code else ""
            return TextractProviderError(f"Amazon Textract client error{prefix}: {err_msg}")

        return TextractProviderError(f"Unexpected Amazon Textract error: {err_msg}")

