import time
import logging
import numpy as np
from app.config import settings
from app.models.hwr_models import HWRResult
from app.providers.base_provider import IHWRProvider
from app.providers.mock_provider import MockProvider
from app.providers.azure_provider import AzureProvider, AzureProviderError
from app.providers.google_vision_provider import GoogleVisionProviderError
from app.utils.image_utils import validate_image

logger = logging.getLogger("app.services.hwr_service")


class HWRServiceError(Exception):
    """Custom exception raised by HandwrittingRecognitionService for service-level errors."""
    pass


class HandwritingRecognitionService:
    """
    Stateless high-level service orchestrator for handwriting recognition (HWR).
    Uses the Factory pattern to initialize concrete providers at runtime
    and wraps execution block timing stats and logger tracking.
    """

    @staticmethod
    def validate_configuration() -> None:
        """
        Fail-fast startup validation for the configured HWR provider.

        When HWR_PROVIDER=azure, this instantiates the provider so that a missing
        endpoint/key (or missing SDK) surfaces immediately as a clear
        configuration error at boot -- never a silent fallback to MockProvider.
        The API key itself is never logged.

        Raises:
            HWRServiceError: If the configured provider cannot be initialized.
        """
        name = (settings.HWR_PROVIDER or "mock").lower().strip()
        logger.info("Validating HWR configuration for provider '%s'...", name)
        # Instantiating validates config for azure; mock is always valid.
        HandwritingRecognitionService.get_provider(name)
        logger.info("HWR provider '%s' configuration is valid.", name)

    @staticmethod
    def get_provider(provider_name: str) -> IHWRProvider:
        """
        Factory method to instantiate the requested handwriting recognition provider.

        Args:
            provider_name: Case-insensitive name of the provider ("mock" or "azure").

        Returns:
            IHWRProvider: An initialized instance of the selected provider.

        Raises:
            HWRServiceError: For unsupported or misconfigured providers.
        """
        name = provider_name.lower().strip()
        logger.info("Initializing HWR provider factory. Selected: '%s'", name)

        if name == "mock":
            return MockProvider()
        elif name == "paddle":
            try:
                from app.providers.paddle_provider import PaddleHWRProvider, PaddleProviderError
                return PaddleHWRProvider()
            except PaddleProviderError as ppe:
                raise HWRServiceError(f"PaddleOCR configuration error: {str(ppe)}") from ppe
            except Exception as e:
                raise HWRServiceError(f"Failed to instantiate PaddleOCR provider: {str(e)}") from e
        elif name == "azure":
            try:
                return AzureProvider()
            except AzureProviderError as ape:
                raise HWRServiceError(f"Azure configuration error: {str(ape)}") from ape
            except Exception as e:
                raise HWRServiceError(f"Failed to instantiate Azure provider: {str(e)}") from e
        elif name == "google_vision":
            try:
                from app.providers.google_vision_provider import GoogleVisionHWRProvider
                return GoogleVisionHWRProvider()
            except GoogleVisionProviderError as gvpe:
                raise HWRServiceError(f"Google Vision configuration error: {str(gvpe)}") from gvpe
            except Exception as e:
                raise HWRServiceError(f"Failed to instantiate Google Vision provider: {str(e)}") from e
        else:
            raise HWRServiceError(
                f"Unsupported HWR provider '{provider_name}'. Supported elements are: 'mock', 'azure', 'paddle', 'google_vision'."
            )

    @classmethod
    def recognize_handwriting(
        cls, 
        image: np.ndarray, 
        provider_name: str = None,
        page_num: int = 1
    ) -> HWRResult:
        """
        Transcribes handwritten text from an image using the selected provider.
        Handles timing checks, logger tracking, and provider exception grouping.
        
        Args:
            image: Preprocessed numpy image.
            provider_name: Optional override for the configured provider.
            
        Returns:
            HWRResult: Standardised output structures.
            
        Raises:
            HWRServiceError: If validation or engine execution fails.
        """
        # 1. Validate image format
        try:
            validate_image(image)
        except ValueError as ve:
            raise HWRServiceError(f"Invalid image array input for HWR service: {str(ve)}") from ve

        # 2. Select provider (runtime selection or settings fallback)
        selected_name = provider_name if provider_name is not None else settings.HWR_PROVIDER
        provider = cls.get_provider(selected_name)

        # 3. Transcribe and time execution
        logger.info("Starting handwriting recognition using provider '%s'...", selected_name)
        start_time = time.time()
        
        try:
            result = provider.recognize(image, page_num=page_num)
        except AzureProviderError as ape:
            # Map specific provider exceptions to service exceptions
            raise HWRServiceError(f"Azure HWR Engine failure: {str(ape)}") from ape
        except GoogleVisionProviderError as gvpe:
            # Map Google Vision exceptions to service exceptions
            raise HWRServiceError(f"Google Vision HWR Engine failure: {str(gvpe)}") from gvpe
        except Exception as e:
            # Catch unexpected downstream errors
            raise HWRServiceError(f"Unexpected error in handwriting recognition provider: {str(e)}") from e
            
        total_elapsed = time.time() - start_time
        
        # Override execution timer to capture total end-to-end service time if provider didn't
        # reflect system delays. E.g. we want accurate service timing metrics.
        result.execution_time = round(total_elapsed, 4)
        
        logger.info(
            "Handwriting recognition completed successfully. "
            "Provider: '%s', Execution Time: %.4fs, Avg Confidence: %.4f",
            result.provider, result.execution_time, result.confidence
        )
        
        return result
