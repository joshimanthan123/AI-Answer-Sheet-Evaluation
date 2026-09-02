import os
import cv2
import numpy as np
from PIL import Image
import io

def validate_image(image: np.ndarray) -> None:
    """
    Validates that the input is a valid, non-empty NumPy image array with acceptable dimensions and channels.
    
    Args:
        image: The input image array.
        
    Raises:
        ValueError: If check fails.
    """
    if image is None:
        raise ValueError("Image cannot be None")
        
    if not isinstance(image, np.ndarray):
        raise ValueError(f"Image must be a numpy ndarray, got {type(image)}")
        
    if image.size == 0:
        raise ValueError("Image array is empty (size is 0)")
        
    if len(image.shape) < 2:
        raise ValueError(f"Invalid image shape {image.shape}. Image must have at least 2 dimensions (height, width)")
        
    height, width = image.shape[:2]
    if height <= 0 or width <= 0:
        raise ValueError(f"Image dimensions must be greater than zero. Got height={height}, width={width}")
        
    # Supported channels: 1 (grayscale), 3 (BGR/RGB), 4 (BGRA/RGBA)
    channels = 1 if len(image.shape) == 2 else image.shape[2]
    if channels not in (1, 3, 4):
        raise ValueError(f"Unsupported number of image channels ({channels}). Must be 1, 3, or 4")


def load_image(image_source: str | bytes) -> np.ndarray:
    """
    Loads an image from a file path or raw bytes and returns it as a NumPy array (BGR layout).
    
    Args:
        image_source: Either a string file path or binary image data.
        
    Returns:
        np.ndarray: Loaded image in BGR (or Grayscale/BGRA) format.
        
    Raises:
        ValueError: If the file path is empty, bytes are empty, or decoding fails.
        FileNotFoundError: If the specified file path does not exist.
    """
    if isinstance(image_source, str):
        if not image_source.strip():
            raise ValueError("File path cannot be empty or blank")
            
        if not os.path.exists(image_source):
            raise FileNotFoundError(f"File not found at path: {image_source}")
            
        # Read the image using OpenCV. By default it reads in BGR mode (or unchanged if specified)
        image = cv2.imread(image_source, cv2.IMREAD_UNCHANGED)
        if image is None:
            raise ValueError(f"OpenCV failed to read/decode the image at path: {image_source}")
            
    elif isinstance(image_source, bytes):
        if not image_source:
            raise ValueError("Input bytes cannot be empty")
            
        # Convert raw bytes to a 1D numpy array of uint8
        np_arr = np.frombuffer(image_source, dtype=np.uint8)
        
        # Decode the image via OpenCV
        image = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
        if image is None:
            raise ValueError("OpenCV failed to decode raw image bytes")
            
    else:
        raise ValueError(f"Unsupported image source type: {type(image_source)}. Must be str (path) or bytes")
        
    validate_image(image)
    return image


def save_image(image: np.ndarray, output_path: str) -> None:
    """
    Saves a NumPy image array to a file path.
    
    Args:
        image: The input image array.
        output_path: File path where the image should be saved.
        
    Raises:
        ValueError: If validation fails.
        IOError: If OpenCV fails to save the image.
    """
    validate_image(image)
    
    # Ensure directory exists
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
        
    success = cv2.imwrite(output_path, image)
    if not success:
        raise IOError(f"OpenCV failed to write image to: {output_path}")


def resize_keep_aspect_ratio(image: np.ndarray, max_width: int, max_height: int) -> np.ndarray:
    """
    Resizes an image maintaining the aspect ratio, only if either its width or height
    exceeds the max limits. Downsamples clean details using INTER_AREA interpolation.
    
    Args:
        image: The input image.
        max_width: Maximum allowed width.
        max_height: Maximum allowed height.
        
    Returns:
        np.ndarray: Resized image.
    """
    validate_image(image)
    
    if max_width <= 0 or max_height <= 0:
        raise ValueError(f"Max width and height must be greater than zero. Got max_width={max_width}, max_height={max_height}")
        
    height, width = image.shape[:2]
    
    # If dimensions are already within bounds, return a copy of the image
    if width <= max_width and height <= max_height:
        return image.copy()
        
    # Find matching ratio
    scale = min(max_width / width, max_height / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # Avoid zero dimension resizing
    new_width = max(1, new_width)
    new_height = max(1, new_height)
    
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)


def convert_to_grayscale(image: np.ndarray) -> np.ndarray:
    """
    Converts a BGR or BGRA image to a 1-channel Grayscale image.
    If the image is already grayscale, returns a copy.
    
    Args:
        image: The input image.
        
    Returns:
        np.ndarray: 1-channel grayscale image.
    """
    validate_image(image)
    
    if len(image.shape) == 2:
        return image.copy()
        
    channels = image.shape[2]
    if channels == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif channels == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    else:
        raise ValueError(f"Cannot convert image with {channels} channels to grayscale")


def remove_noise(image: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    """
    Applies Gaussian Blur to remove high-frequency noise/speckles.
    
    Args:
        image: The input image.
        kernel_size: The blur kernel size (must be a positive odd integer).
        
    Returns:
        np.ndarray: Blurred image.
    """
    validate_image(image)
    
    if kernel_size <= 0 or kernel_size % 2 == 0:
        raise ValueError(f"Kernel size must be a positive odd integer. Got: {kernel_size}")
        
    return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """
    Enhances local image contrast using Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Works on both grayscale and color images (in LAB coordinates for color).
    
    Args:
        image: The input image.
        
    Returns:
        np.ndarray: Contrast-enhanced image.
    """
    validate_image(image)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    
    if len(image.shape) == 2:
        # Grayscale
        return clahe.apply(image)
    else:
        # Color image (BGR or BGRA)
        # Convert to LAB structure where CLAHE can be applied on L (luminance) channel safely.
        has_alpha = (image.shape[2] == 4)
        
        if has_alpha:
            bgr = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
            alpha = image[:, :, 3]
        else:
            bgr = image
            
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to the L channel
        l_enhanced = clahe.apply(l)
        
        # Merge back
        lab_enhanced = cv2.merge((l_enhanced, a, b))
        bgr_enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
        
        if has_alpha:
            return cv2.merge((bgr_enhanced[:, :, 0], bgr_enhanced[:, :, 1], bgr_enhanced[:, :, 2], alpha))
        return bgr_enhanced


def get_skew_angle(image: np.ndarray) -> float:
    """
    Detects the skew angle of the text lines in an image.
    
    Args:
        image: The input image.
        
    Returns:
        float: The detected skew angle in degrees (negative for clockwise, positive for counter-clockwise).
    """
    validate_image(image)
    
    # 1. Convert to gray for analysis
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif len(image.shape) == 4:
        gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    else:
        gray = image.copy()
        
    # 2. Standardize foreground/background
    # Most documents are dark text on a light background.
    # Check average intensity, if light background, invert it.
    mean_val = np.mean(gray)
    if mean_val > 127:
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    else:
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        
    # 3. Apply horizontal dilation to group characters together into longer text lines.
    # This gives a better angle estimate.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=1)
    
    # 4. Find all contour points of these groups
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0
        
    # Filter small contours (noise) that could distort the angle estimation
    valid_contours = [c for c in contours if cv2.contourArea(c) > 50]
    if not valid_contours:
        valid_contours = contours # fallback
        
    if not valid_contours:
        return 0.0
        
    # Merge all points
    all_pts = np.concatenate(valid_contours)
    
    # 5. Extract bounding box angle
    rect = cv2.minAreaRect(all_pts)
    (cx, cy), (width, height), angle = rect
    
    # 6. Normalize OpenCV minAreaRect angle
    # In OpenCV 4.x, cv2.minAreaRect(..) returns angles in ranges like [-90, 0] or [0, 90].
    # We want to identify the skew relative to the dominant horizontal line.
    if width < height:
        angle = angle + 90
        
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90
        
    # Force limit correction (skip if skew is unrealistically high, e.g. upside down)
    if abs(angle) > 40:
        return 0.0
        
    return float(angle)


def deskew(image: np.ndarray) -> np.ndarray:
    """
    Stops skew angle in document text and rotates the image to make it straight.
    Uses cv2.minAreaRect on dilated text components to estimate orientation.
    
    Args:
        image: The input image.
        
    Returns:
        np.ndarray: Rotation corrected image (padded with white background).
    """
    validate_image(image)
    
    angle = get_skew_angle(image)
    
    # If the detected skew is extremely small, skip rotation
    if abs(angle) < 0.05:
        return image.copy()
        
    # 7. Warp the image
    h_img, w_img = image.shape[:2]
    center = (w_img // 2, h_img // 2)
    
    # Create rotation matrix
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Padding color: white for standard papers
    border_color = (255, 255, 255) if len(image.shape) >= 3 else (255,)
    
    # Rotate with high-quality cubic interpolation, filling margins with white
    rotated = cv2.warpAffine(
        image, M, (w_img, h_img),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_color
    )
    
    return rotated


def adaptive_threshold(image: np.ndarray, block_size: int = 11, c: int = 2) -> np.ndarray:
    """
    Performs binarization using adaptive thresholding.
    Converts image to grayscale first if it contains color.
    
    Args:
        image: The input image.
        block_size: Size of a pixel neighborhood (odd integer > 1).
        c: Constant subtracted from the mean.
        
    Returns:
        np.ndarray: Binarized (black/white) 1-channel image.
    """
    validate_image(image)
    
    if block_size <= 1 or block_size % 2 == 0:
        raise ValueError(f"Block size must be an odd integer greater than 1. Got: {block_size}")
        
    gray = convert_to_grayscale(image)
    
    return cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size, c
    )


def morphological_cleanup(image: np.ndarray, operation: str = "open", kernel_size: int = 3) -> np.ndarray:
    """
    Performs morphological cleanup (opening or closing) to reduce noise.
    
    Args:
        image: The input image (typically binary).
        operation: The morphology type: "open" (noise removal) or "close" (connection).
        kernel_size: Size of the rectangular structuring element.
        
    Returns:
        np.ndarray: Mapped output image.
    """
    validate_image(image)
    
    if kernel_size <= 0:
        raise ValueError(f"Kernel size must be a positive integer. Got: {kernel_size}")
        
    if operation not in ("open", "close"):
        raise ValueError(f"Unsupported morphology operation: {operation}. Supported paths: 'open', 'close'")
        
    op_type = cv2.MORPH_OPEN if operation == "open" else cv2.MORPH_CLOSE
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    
    return cv2.morphologyEx(image, op_type, kernel)


def otsu_threshold(image: np.ndarray) -> np.ndarray:
    """
    Performs global binarization using Otsu's thresholding method.
    Converts image to grayscale first if it contains color channels.
    
    Args:
        image: The input image.
        
    Returns:
        np.ndarray: Binarized 1-channel image.
    """
    validate_image(image)
    gray = convert_to_grayscale(image)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def upscale_image(image: np.ndarray, scale_factor: float = 1.5) -> np.ndarray:
    """
    Upscales an image by a scaling factor using bicubic interpolation.
    
    Args:
        image: The input image.
        scale_factor: Multiplier for width and height (> 0).
        
    Returns:
        np.ndarray: Upscaled image.
    """
    validate_image(image)
    if scale_factor <= 0:
        raise ValueError(f"Scale factor must be positive. Got: {scale_factor}")
        
    height, width = image.shape[:2]
    new_width = int(width * scale_factor)
    new_height = int(height * scale_factor)
    
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)


def denoise_bilateral(image: np.ndarray, d: int = 9, sigma_color: float = 75.0, sigma_space: float = 75.0) -> np.ndarray:
    """
    Applies bilateral filter for edge-preserving noise reduction.
    
    Args:
        image: The input image.
        d: Diameter of pixel neighborhood.
        sigma_color: Filter sigma in color space.
        sigma_space: Filter sigma in coordinate space.
        
    Returns:
        np.ndarray: Filtered image.
    """
    validate_image(image)
    return cv2.bilateralFilter(image, d, sigma_color, sigma_space)

