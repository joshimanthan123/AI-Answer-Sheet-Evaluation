import os
import sys
import time
import logging
import cv2
import numpy as np

# Ensure ocr-service root is in sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.services.preprocess_service import ImagePreprocessor, PreprocessConfig

# Configure logging to console for testing visibility
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s] - %(message)s"
)
logger = logging.getLogger("test_runner")


def ensure_directories():
    """Create essential sample and outcome folders for local verification testing."""
    os.makedirs("tests/sample_images", exist_ok=True)
    os.makedirs("tests/outputs", exist_ok=True)


def generate_sample_images():
    """
    Programmatically creates a realistic test dataset representing common issues
    encountered with scanned student hand-written documents.
    """
    ensure_directories()
    
    # 1. Base canvas for drawing text: 800 x 600 white background
    base = np.ones((800, 600, 3), dtype=np.uint8) * 255
    
    # Draw some standard mock exam paper details
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(base, "AI BASED AUTOMATED EVALUATION SHEET", (40, 100), font, 0.8, (20, 20, 20), 2, cv2.LINE_AA)
    cv2.putText(base, "Candidate Name: Joshi Manthan", (40, 180), font, 0.6, (40, 40, 40), 2, cv2.LINE_AA)
    cv2.putText(base, "Student ID (Roll No): 24CE05SGP", (40, 230), font, 0.6, (40, 40, 40), 2, cv2.LINE_AA)
    cv2.putText(base, "Q1. Explain the difference between CNN and FCN.", (40, 320), font, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
    cv2.putText(base, "Ans: CNN stands for Convolutional Neural Network,", (40, 380), font, 0.5, (50, 50, 50), 1, cv2.LINE_AA)
    cv2.putText(base, "typically used for classification tasks.", (40, 410), font, 0.5, (50, 50, 50), 1, cv2.LINE_AA)
    cv2.putText(base, "FCN is Fully Convolutional Network for segmentation.", (40, 440), font, 0.5, (50, 50, 50), 1, cv2.LINE_AA)
    
    # Save Clean Image
    clean_path = "tests/sample_images/clean.jpg"
    cv2.imwrite(clean_path, base)
    logger.info("Successfully generated: %s", clean_path)

    # 2. Noisy Image (Add Gaussian noise / scanning speckles)
    noisy = base.copy()
    noise = np.random.normal(0, 25, noisy.shape).astype(np.float32)
    noisy_float = noisy.astype(np.float32) + noise
    noisy = np.clip(noisy_float, 0, 255).astype(np.uint8)
    
    noisy_path = "tests/sample_images/noisy.jpg"
    cv2.imwrite(noisy_path, noisy)
    logger.info("Successfully generated: %s", noisy_path)

    # 3. Skewed Image (Rotated image by 5.5 degrees clockwise with a white background)
    skewed = base.copy()
    h, w = skewed.shape[:2]
    center = (w // 2, h // 2)
    angle = -5.5  # Skew angle in degrees
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    skewed = cv2.warpAffine(skewed, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
    
    skewed_path = "tests/sample_images/skewed.jpg"
    cv2.imwrite(skewed_path, skewed)
    logger.info("Successfully generated: %s", skewed_path)

    # 4. Dark/Low Contrast Image (Simulate bad lighting/scanner contrast issues)
    # Brightness scaling down to ~35% and shifting baseline intensity
    dark = (base.astype(np.float32) * 0.35 + 40).astype(np.uint8)
    
    dark_path = "tests/sample_images/dark.jpg"
    cv2.imwrite(dark_path, dark)
    logger.info("Successfully generated: %s", dark_path)


def run_pipeline_test():
    """Iterates through generated sample images and executes prepreprocessing pipeline."""
    sample_images = ["clean.jpg", "noisy.jpg", "skewed.jpg", "dark.jpg"]
    preprocessor = ImagePreprocessor()
    
    logger.info("=" * 60)
    logger.info("STARTING PREPROCESSING PIPELINE TESTS")
    logger.info("=" * 60)
    
    # Configure custom parameters if desired, else use default configs
    config = PreprocessConfig(
        resize=True,
        grayscale=True,
        denoise=True,
        contrast=True,
        deskew=True,
        threshold=True,
        morphology=True
    )
    
    for filename in sample_images:
        input_path = f"tests/sample_images/{filename}"
        logger.info("-" * 50)
        logger.info("Processing test case file: %s", input_path)
        
        try:
            # 1. Load image
            img = preprocessor.load(input_path)
            
            # 2. Run Preprocess Pipeline
            result = preprocessor.preprocess(img, config)
            
            # 3. Print Metadata Results
            logger.info("Execution stats for %s:", filename)
            logger.info("  Original size   : %s", result.metadata["original_size"])
            logger.info("  Processed size  : %s", result.metadata["processed_size"])
            logger.info("  Deskew skew angle: %.2f degrees", result.metadata["deskew_angle"])
            logger.info("  Processing time : %.4fs", result.metadata["processing_time"])
            logger.info("  Steps completed : %s", result.metadata["steps_executed"])
            
            # 4. Save results to output folder for quality check
            base_name = os.path.splitext(filename)[0]
            preprocessor.save(result.processed, f"tests/outputs/{base_name}_processed.jpg")
            if result.grayscale is not None:
                preprocessor.save(result.grayscale, f"tests/outputs/{base_name}_grayscale.jpg")
                
            logger.info("Outputs written to tests/outputs/ folder.")
            
        except Exception as e:
            logger.error("Exception occurred processing %s: %s", filename, str(e), exc_info=True)


if __name__ == "__main__":
    logger.info("Setting up sample test environment...")
    generate_sample_images()
    run_pipeline_test()
    logger.info("All preprocessing test cases finished.")
