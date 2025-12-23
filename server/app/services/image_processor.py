"""
Image Processor Service
Advanced image processing for converting images to grid masks.
Uses OpenCV for background detection, segmentation, and morphological operations.
"""
import cv2
import numpy as np
from scipy import ndimage


def process_image_to_grid(image_data: bytes, grid_width: int, grid_height: int) -> dict:
    """
    Process an image and convert it to a grid mask using multiple strategies.
    Prioritizes finding large solid regions (silhouettes).
    Properly handles transparent PNG images.
    """
    try:
        print(f"[ImageProcessor] Processing image to {grid_width}x{grid_height} grid")
        
        # Load image from bytes, preserving alpha channel if present
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        
        if img is None:
            return {"error": "Failed to decode image"}
        
        original_shape = img.shape
        print(f"[ImageProcessor] Original image: {original_shape[1]}x{original_shape[0]}, channels: {img.shape[2] if len(img.shape) > 2 else 1}")
        
        # Check if image has alpha channel (4 channels = BGRA)
        has_alpha = len(img.shape) == 3 and img.shape[2] == 4
        
        if has_alpha:
            print("[ImageProcessor] Detected alpha channel, using alpha-based segmentation")
            result = _alpha_segmentation(img, grid_width, grid_height)
            if result and result['stats']['fill_ratio'] > 5:  # At least 5% filled
                print(f"[ImageProcessor] Alpha segmentation: {result['stats']['fill_ratio']}% filled")
                # Ensure mask is centered before returning
                result = _center_mask(result, grid_width, grid_height)
                return result
            print("[ImageProcessor] Alpha segmentation gave poor results, falling back to color-based")
            # Convert to BGR for fallback
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        elif len(img.shape) == 2:
            # Grayscale image - convert to BGR
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        
        # Resize to grid dimensions (preserving aspect ratio)
        img_resized = _resize_contain(img, grid_width, grid_height)
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        
        # Strategy 1: K-means clustering (2 clusters for foreground/background)
        result1 = _kmeans_segmentation(img_resized, grid_width, grid_height)
        
        # Strategy 2: Edge-based border analysis
        result2 = _border_analysis(img_resized, gray, grid_width, grid_height)
        
        # Strategy 3: Contrast-based detection
        result3 = _contrast_detection(gray, grid_width, grid_height)
        
        # Choose best result based on fill ratio (prefer 20-60% filled)
        results = [result1, result2, result3]
        best_result = None
        best_score = float('inf')
        
        for i, r in enumerate(results):
            if r is None:
                continue
            fill_ratio = r['stats']['fill_ratio'] / 100
            # Score: prefer fill ratio between 20% and 60%
            if fill_ratio < 0.05:
                score = 100  # Too empty
            elif fill_ratio > 0.80:
                score = 100  # Too full
            else:
                # Prefer around 30-50%
                score = abs(fill_ratio - 0.4) * 10
            
            print(f"[ImageProcessor] Strategy {i+1}: {r['stats']['fill_ratio']}% filled, score: {score:.2f}")
            
            if score < best_score:
                best_score = score
                best_result = r
        
        if best_result is None:
            # Fallback to simple threshold
            best_result = _simple_threshold(gray, grid_width, grid_height)
        
        # Post-process: center the mask based on bounding box
        best_result = _center_mask(best_result, grid_width, grid_height)
        
        print(f"[ImageProcessor] Selected: {best_result['stats']['method']} with {best_result['stats']['fill_ratio']}% fill")
        return best_result
        
    except Exception as e:
        print(f"[ImageProcessor] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


def _center_mask(result, grid_width, grid_height):
    """
    Center the foreground content within the grid based on bounding box.
    This corrects any offset from the original image positioning.
    """
    if result is None or 'grid' not in result:
        return result
    
    try:
        # Convert grid to numpy array
        grid = np.array(result['grid'], dtype=np.uint8)
        
        # Find bounding box of foreground (True/1 cells)
        rows_with_fg = np.any(grid, axis=1)
        cols_with_fg = np.any(grid, axis=0)
        
        if not np.any(rows_with_fg) or not np.any(cols_with_fg):
            # No foreground - return as-is
            return result
        
        # Get bounding box
        min_row = np.argmax(rows_with_fg)
        max_row = len(rows_with_fg) - 1 - np.argmax(rows_with_fg[::-1])
        min_col = np.argmax(cols_with_fg)
        max_col = len(cols_with_fg) - 1 - np.argmax(cols_with_fg[::-1])
        
        fg_height = max_row - min_row + 1
        fg_width = max_col - min_col + 1
        
        # Calculate current center and target center
        curr_center_row = (min_row + max_row) / 2
        curr_center_col = (min_col + max_col) / 2
        target_center_row = (grid_height - 1) / 2
        target_center_col = (grid_width - 1) / 2
        
        # Calculate shift needed
        shift_row = int(round(target_center_row - curr_center_row))
        shift_col = int(round(target_center_col - curr_center_col))
        
        # Only skip if already perfectly centered
        if shift_row == 0 and shift_col == 0:
            return result
        
        print(f"[ImageProcessor] Centering mask: shift ({shift_row}, {shift_col})")
        
        # Create new centered grid
        new_grid = np.zeros((grid_height, grid_width), dtype=np.uint8)
        
        # Calculate source and destination ranges with boundary checks
        src_row_start = max(0, -shift_row)
        src_row_end = min(grid_height, grid_height - shift_row)
        src_col_start = max(0, -shift_col)
        src_col_end = min(grid_width, grid_width - shift_col)
        
        dst_row_start = max(0, shift_row)
        dst_row_end = min(grid_height, grid_height + shift_row)
        dst_col_start = max(0, shift_col)
        dst_col_end = min(grid_width, grid_width + shift_col)
        
        # Copy with shift
        height = min(src_row_end - src_row_start, dst_row_end - dst_row_start)
        width = min(src_col_end - src_col_start, dst_col_end - dst_col_start)
        
        new_grid[dst_row_start:dst_row_start+height, dst_col_start:dst_col_start+width] = \
            grid[src_row_start:src_row_start+height, src_col_start:src_col_start+width]
        
        # Update result
        result['grid'] = (new_grid > 0).tolist()
        result['stats']['centered'] = True
        
        return result
        
    except Exception as e:
        print(f"[ImageProcessor] Center correction failed: {e}")
        return result


def _alpha_segmentation(img_bgra, grid_width, grid_height):
    """
    Use alpha channel to segment foreground from background.
    Pixels with alpha > threshold are considered foreground.
    """
    try:
        # Extract alpha channel
        alpha = img_bgra[:, :, 3]
        bgr = img_bgra[:, :, :3]
        
        # Resize both alpha and BGR to grid dimensions
        h, w = alpha.shape
        image_aspect = w / h
        target_aspect = grid_width / grid_height
        
        if image_aspect > target_aspect:
            # Fit to width
            new_w = grid_width
            new_h = int(grid_width / image_aspect)
        else:
            # Fit to height
            new_h = grid_height
            new_w = int(grid_height * image_aspect)
        
        # Resize alpha
        alpha_resized = cv2.resize(alpha, (new_w, new_h), interpolation=cv2.INTER_AREA)
        
        # Create canvas with zeros (transparent = background = False)
        canvas = np.zeros((grid_height, grid_width), dtype=np.uint8)
        
        # Calculate offset to center
        y_offset = (grid_height - new_h) // 2
        x_offset = (grid_width - new_w) // 2
        
        # Paste resized alpha
        canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = alpha_resized
        
        # Threshold: alpha > 128 = foreground (opaque)
        mask = (canvas > 128).astype(np.uint8) * 255
        
        # Clean up with morphology
        kernel = np.ones((2, 2), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        grid = (mask > 0).tolist()
        cell_count = int(np.sum(mask > 0))
        fill_ratio = cell_count / (grid_width * grid_height)
        
        return {
            "grid": grid,
            "stats": {
                "cell_count": cell_count,
                "fill_ratio": round(fill_ratio * 100, 1),
                "method": "alpha_channel"
            }
        }
    except Exception as e:
        print(f"[ImageProcessor] Alpha segmentation failed: {e}")
        return None


def _kmeans_segmentation(img, grid_width, grid_height):
    """K-means clustering to separate foreground from background."""
    try:
        # Reshape image for k-means
        pixels = img.reshape(-1, 3).astype(np.float32)
        
        # K-means with 2 clusters
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        _, labels, centers = cv2.kmeans(pixels, 2, None, criteria, 5, cv2.KMEANS_RANDOM_CENTERS)
        
        # Reshape labels back to image
        labels_img = labels.reshape(grid_height, grid_width)
        
        # Determine which cluster is foreground (darker usually = foreground)
        # Or the one that's not at corners
        corner_labels = [
            labels_img[0, 0], labels_img[0, -1],
            labels_img[-1, 0], labels_img[-1, -1]
        ]
        bg_label = np.bincount(corner_labels).argmax()
        fg_label = 1 - bg_label
        
        # Create mask
        mask = (labels_img == fg_label).astype(np.uint8) * 255
        
        # Clean up with morphology
        kernel = np.ones((2, 2), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        grid = (mask > 0).tolist()
        cell_count = int(np.sum(mask > 0))
        fill_ratio = cell_count / (grid_width * grid_height)
        
        return {
            "grid": grid,
            "stats": {
                "cell_count": cell_count,
                "fill_ratio": round(fill_ratio * 100, 1),
                "method": "kmeans"
            }
        }
    except Exception as e:
        print(f"[ImageProcessor] K-means failed: {e}")
        return None


def _border_analysis(img, gray, grid_width, grid_height):
    """Analyze border pixels to detect background color."""
    try:
        # Collect border pixels (top, bottom, left, right edges)
        border_pixels = []
        for c in range(gray.shape[1]):
            border_pixels.extend([gray[0, c], gray[-1, c]])
        for r in range(gray.shape[0]):
            border_pixels.extend([gray[r, 0], gray[r, -1]])
        
        # Find background color as median of border pixels
        bg_gray = int(np.median(border_pixels))
        bg_std = int(np.std(border_pixels))
        
        print(f"[ImageProcessor] Border analysis: bg_gray={bg_gray}, bg_std={bg_std}")
        
        # If border is uniform (low std), treat as solid background
        if bg_std < 30:
            # Calculate difference from background
            diff = np.abs(gray.astype(np.int16) - bg_gray).astype(np.uint8)
            
            # Threshold: pixels different from background by more than 25
            threshold = max(25, bg_std * 2)
            mask = (diff > threshold).astype(np.uint8) * 255
        else:
            # Border is not uniform, use Otsu
            _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Clean up
        kernel = np.ones((2, 2), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Keep only large components
        mask = _keep_large_components(mask, min_ratio=0.03)
        
        grid = (mask > 0).tolist()
        cell_count = int(np.sum(mask > 0))
        fill_ratio = cell_count / (grid_width * grid_height)
        
        return {
            "grid": grid,
            "stats": {
                "cell_count": cell_count,
                "fill_ratio": round(fill_ratio * 100, 1),
                "method": "border_analysis"
            }
        }
    except Exception as e:
        print(f"[ImageProcessor] Border analysis failed: {e}")
        return None


def _contrast_detection(gray, grid_width, grid_height):
    """Use local contrast to detect regions of interest."""
    try:
        # Calculate local standard deviation (contrast)
        local_mean = cv2.blur(gray.astype(np.float32), (3, 3))
        local_sq_mean = cv2.blur((gray.astype(np.float32) ** 2), (3, 3))
        local_std = np.sqrt(np.maximum(local_sq_mean - local_mean ** 2, 0))
        
        # High contrast regions are likely edges/features
        contrast_norm = (local_std / (local_std.max() + 1e-6) * 255).astype(np.uint8)
        
        # Also use Sobel edge detection
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        edge_mag = np.sqrt(sobelx**2 + sobely**2)
        edge_norm = (edge_mag / (edge_mag.max() + 1e-6) * 255).astype(np.uint8)
        
        # Combine contrast and edges
        combined = cv2.addWeighted(contrast_norm, 0.5, edge_norm, 0.5, 0)
        
        # Threshold
        _, mask = cv2.threshold(combined, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Dilate to fill gaps
        kernel = np.ones((2, 2), np.uint8)
        mask = cv2.dilate(mask, kernel, iterations=1)
        
        # Fill holes using flood fill
        mask_filled = mask.copy()
        h, w = mask.shape
        flood_mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(mask_filled, flood_mask, (0, 0), 255)
        mask_inv = cv2.bitwise_not(mask_filled)
        mask = cv2.bitwise_or(mask, mask_inv)
        
        grid = (mask > 0).tolist()
        cell_count = int(np.sum(mask > 0))
        fill_ratio = cell_count / (grid_width * grid_height)
        
        return {
            "grid": grid,
            "stats": {
                "cell_count": cell_count,
                "fill_ratio": round(fill_ratio * 100, 1),
                "method": "contrast"
            }
        }
    except Exception as e:
        print(f"[ImageProcessor] Contrast detection failed: {e}")
        return None


def _simple_threshold(gray, grid_width, grid_height):
    """Simple Otsu threshold as fallback."""
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    grid = (mask > 0).tolist()
    cell_count = int(np.sum(mask > 0))
    fill_ratio = cell_count / (grid_width * grid_height)
    
    return {
        "grid": grid,
        "stats": {
            "cell_count": cell_count,
            "fill_ratio": round(fill_ratio * 100, 1),
            "method": "simple_threshold"
        }
    }


def _keep_large_components(mask, min_ratio=0.03):
    """Keep only connected components larger than min_ratio of total area."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    
    h, w = mask.shape
    min_area = h * w * min_ratio
    
    result = np.zeros_like(mask)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            result[labels == i] = 255
    
    return result


# Keep the other methods for API compatibility
def process_image_silhouette(image_data: bytes, grid_width: int, grid_height: int) -> dict:
    """Alias for main processing function."""
    return process_image_to_grid(image_data, grid_width, grid_height)


def process_image_dark_regions(image_data: bytes, grid_width: int, grid_height: int, threshold: int = None) -> dict:
    """Simple dark region detection."""
    try:
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": "Failed to decode image"}
        
        img_resized = _resize_contain(img, grid_width, grid_height)
        # img_resized = cv2.resize(img, (grid_width, grid_height), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        
        if threshold is None:
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        else:
            _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)
        
        grid = (binary > 0).tolist()
        cell_count = int(np.sum(binary > 0))
        fill_ratio = cell_count / (grid_width * grid_height)
        
        return {
            "grid": grid,
            "stats": {
                "cell_count": cell_count,
                "fill_ratio": round(fill_ratio * 100, 1),
                "method": "dark_regions"
            }
        }
    except Exception as e:
        return {"error": str(e)}

def _resize_contain(image, target_width, target_height):
    """
    Resize image to fit within target dimensions while maintaining aspect ratio.
    Centers the image on a black background.
    """
    h, w = image.shape[:2]
    image_aspect = w / h
    target_aspect = target_width / target_height
    
    if image_aspect > target_aspect:
        # Fit to width
        new_w = target_width
        new_h = int(target_width / image_aspect)
    else:
        # Fit to height
        new_h = target_height
        new_w = int(target_height * image_aspect)
        
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    # Determine background color from the edges of the resized image
    # Sample top, bottom, left, and right edges
    edge_pixels = np.vstack([
        resized[0, :, :],
        resized[-1, :, :],
        resized[:, 0, :],
        resized[:, -1, :]
    ])
    bg_color = np.median(edge_pixels, axis=0).astype(np.uint8)
    
    # Create canvas filled with detected background color
    canvas = np.full((target_height, target_width, 3), bg_color, dtype=np.uint8)
    
    # Calculate offset
    y_offset = (target_height - new_h) // 2
    x_offset = (target_width - new_w) // 2
    
    # Paste
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized
    
    return canvas
