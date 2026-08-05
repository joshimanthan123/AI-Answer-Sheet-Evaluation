from abc import ABC, abstractmethod
import numpy as np
from app.models.hwr_models import HWRResult

class IHWRProvider(ABC):
    """
    Abstract Base Class (Interface) that all handwriting recognition (HWR) providers
    must implement. Ensures engine-agnostic interactions inside the business logic.
    """
    
    @abstractmethod
    def recognize(self, image: np.ndarray) -> HWRResult:
        """
        Processes a preprocessed document image and transcribes its contents.
        
        Args:
            image: Preprocessed 1-channel or 3-channel numpy image array.
            
        Returns:
            HWRResult: Reconstructed text pages with line-by-line statistics.
            
        Raises:
            ValueError: If the input image validation fails.
            Exception: Custom service exceptions if an engine crash occurs during transcription.
        """
        pass
