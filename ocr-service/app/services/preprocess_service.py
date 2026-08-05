from dataclasses import dataclass, field
import time
import logging
import numpy as np
from app.utils.image_utils import (
    load_image,
    save_image,
    resize_keep_aspect_ratio,
    convert_to_grayscale,
    remove_noise,
    enhance_contrast,
    get_skew_angle,
    deskew,
    adaptive_threshold,
    morphological_cleanup
)

logger = logging.getLogger("app.services.preprocess_service")

@dataclass
class PreprocessConfig:
    """
    Configuration parameters for custom control of the image preprocessing pipeline steps.
    """
    resize: bool = True
    grayscale: bool = True
    denoise: bool = True
    contrast: bool = True
    deskew: bool = True
    threshold: bool = True
    morphology: bool = True

    # Custom threshold parameters
    max_width: int = 1500
    max_height: int = 1500
    blur_kernel_size: int = 5
    threshold_block_size: int = 11
    threshold_c: int = 2
    morphology_op: str = "open"
    morphology_kernel_size: int = 3


@dataclass
class PreprocessResult:
    """
    Structured outcome of the image preprocessing pipeline containing the intermediate steps
    and calculation metadata.
    """
    original: np.ndarray
    grayscale: np.ndarray | None
    processed: np.ndarray
    metadata: dict


class ImagePreprocessor:
    """
    Stateless high-level orchestrator for loading, preprocessing, and saving document images.
    Encapsulates sequential execution, timing metrics, and configuration options.
    """
    
    @staticmethod
    def load(source: str | bytes) -> np.ndarray:
        """
        Loads an image from files or raw bytes. Delegates to image_utils.
        
        Args:
            source: Path to file or image content bytes.
            
        Returns:
            np.ndarray: Loaded image array.
        """
        logger.info("Loading image from provided source...")
        try:
            image = load_image(source)
            logger.info("Image loaded successfully. Dimensions: %s", image.shape)
            return image
        except Exception as e:
            logger.exception("Failed to load image.")
            raise

    @staticmethod
    def save(image: np.ndarray, output_path: str) -> None:
        """
        Writes an image to disk. Delegates to image_utils.
        
        Args:
            image: Image array.
            output_path: Target write directory & filename.
        """
        logger.info("Saving image to path: %s", output_path)
        try:
            save_image(image, output_path)
            logger.info("Image saved successfully.")
        except Exception as e:
            logger.exception("Failed to save image to %s", output_path)
            raise

    @staticmethod
    def preprocess(image: np.ndarray, config: PreprocessConfig = None) -> PreprocessResult:
        """
        Executes sequence of image preprocessing operations based on configuration.
        Tracks execution times, shape transformations, and skew angles.
        
        Args:
            image: The input numpy image array.
            config: Optional PreprocessConfig instance. Defaults to everything enabled.
            
        Returns:
            PreprocessResult: Object containing original, grayscale, processed image, and metadata.
        """
        if config is None:
            config = PreprocessConfig()

        start_time = time.time()
        steps_executed = []
        metadata = {}

        # Capture original size info
        original_shape = image.shape
        metadata["original_size"] = (original_shape[1], original_shape[0])  # (width, height)
        metadata["deskew_angle"] = 0.0

        current_img = image.copy()
        gray_img = None

        # 1. Resize Step
        if config.resize:
            step_start = time.time()
            current_img = resize_keep_aspect_ratio(
                current_img, 
                config.max_width, 
                config.max_height
            )
            step_elapsed = time.time() - step_start
            steps_executed.append("resize")
            logger.info("Resize step completed in %.4fs. New shape: %s", step_elapsed, current_img.shape)

        # 2. Grayscale Step
        if config.grayscale:
            step_start = time.time()
            current_img = convert_to_grayscale(current_img)
            gray_img = current_img.copy()
            step_elapsed = time.time() - step_start
            steps_executed.append("grayscale")
            logger.info("Grayscale conversion completed in %.4fs.", step_elapsed)
        else:
            # If grayscale is disabled but user wants adaptive threshold, 
            # we need a fallback or grayscale reference
            if len(current_img.shape) == 2:
                gray_img = current_img.copy()
            else:
                gray_img = convert_to_grayscale(current_img)

        # 3. Denoise Step
        if config.denoise:
            step_start = time.time()
            current_img = remove_noise(current_img, config.blur_kernel_size)
            step_elapsed = time.time() - step_start
            steps_executed.append("denoise")
            logger.info("Gaussian Blur noise removal completed in %.4fs.", step_elapsed)

        # 4. Enhance Contrast Step
        if config.contrast:
            step_start = time.time()
            current_img = enhance_contrast(current_img)
            step_elapsed = time.time() - step_start
            steps_executed.append("contrast")
            logger.info("CLAHE contrast enhancement completed in %.4fs.", step_elapsed)

        # 5. Deskew Step
        if config.deskew:
            step_start = time.time()
            # Calculate skew angle on current image
            angle = get_skew_angle(current_img)
            metadata["deskew_angle"] = angle
            
            # Apply rotation
            current_img = deskew(current_img)
            
            # If the grayscale checkpoint was set, rotate it too so we preserve aligned grayscale
            if gray_img is not None and abs(angle) >= 0.05:
                # Re-apply deskew to grayscale image to keep them aligned
                gray_img = deskew(gray_img)

            step_elapsed = time.time() - step_start
            steps_executed.append("deskew")
            logger.info("Deskew correction completed in %.4fs. Detected angle: %.2f degrees", step_elapsed, angle)

        # 6. Adaptive Threshold Step
        if config.threshold:
            step_start = time.time()
            current_img = adaptive_threshold(
                current_img, 
                config.threshold_block_size, 
                config.threshold_c
            )
            step_elapsed = time.time() - step_start
            steps_executed.append("threshold")
            logger.info("Adaptive Threshold completed in %.4fs.", step_elapsed)

        # 7. Morphological Cleanup Step
        if config.morphology:
            step_start = time.time()
            current_img = morphological_cleanup(
                current_img, 
                config.morphology_op, 
                config.morphology_kernel_size
            )
            step_elapsed = time.time() - step_start
            steps_executed.append("morphology")
            logger.info("Morphological cleanup completed in %.4fs.", step_elapsed)

        # Compile metadata
        total_time = time.time() - start_time
        processed_shape = current_img.shape
        
        metadata["processing_time"] = round(total_time, 4)
        metadata["steps_executed"] = steps_executed
        metadata["processed_size"] = (processed_shape[1], processed_shape[0])  # (width, height)

        logger.info(
            "Preprocess pipeline completed in %.4fs. Steps: %s. Final Output shape: %s", 
            total_time, steps_executed, processed_shape
        )

        return PreprocessResult(
            original=image,
            grayscale=gray_img,
            processed=current_img,
            metadata=metadata
        )
