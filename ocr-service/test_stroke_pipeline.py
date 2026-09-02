import os
import cv2
import numpy as np
import math

# Ensure debug directory exists
debug_dir = os.path.join(os.path.dirname(__file__), "debug")
os.makedirs(debug_dir, exist_ok=True)

def generate_hello_world_strokes():
    """Generates synthetic stroke coordinates representing 'HELLO WORLD' in handwriting."""
    strokes = []
    
    def add_stroke(points, width=4, color="#000000"):
        strokes.append({"points": [{"x": float(p[0]), "y": float(p[1])} for p in points], "width": width, "color": color})
    
    # 'H'
    add_stroke([(50, 100), (50, 200)])
    add_stroke([(50, 150), (90, 150)])
    add_stroke([(90, 100), (90, 200)])
    
    # 'E'
    add_stroke([(110, 100), (110, 200)])
    add_stroke([(110, 100), (150, 100)])
    add_stroke([(110, 150), (140, 150)])
    add_stroke([(110, 200), (150, 200)])
    
    # 'L'
    add_stroke([(170, 100), (170, 200)])
    add_stroke([(170, 200), (210, 200)])
    
    # 'L'
    add_stroke([(230, 100), (230, 200)])
    add_stroke([(230, 200), (270, 200)])
    
    # 'O'
    # Circle approx
    o_pts = []
    for angle in range(0, 360, 20):
        rad = math.radians(angle)
        o_pts.append((320 + 25 * math.cos(rad), 150 + 45 * math.sin(rad)))
    o_pts.append(o_pts[0])
    add_stroke(o_pts)
    
    # Space
    
    # 'W'
    add_stroke([(380, 100), (400, 200)])
    add_stroke([(400, 200), (420, 140)])
    add_stroke([(420, 140), (440, 200)])
    add_stroke([(440, 200), (460, 100)])
    
    # 'O'
    o2_pts = []
    for angle in range(0, 360, 20):
        rad = math.radians(angle)
        o2_pts.append((500 + 25 * math.cos(rad), 150 + 45 * math.sin(rad)))
    o2_pts.append(o2_pts[0])
    add_stroke(o2_pts)
    
    # 'R'
    add_stroke([(540, 100), (540, 200)])
    r_pts = []
    for angle in range(-90, 90, 20):
        rad = math.radians(angle)
        r_pts.append((540 + 25 * math.cos(rad), 125 + 25 * math.sin(rad)))
    add_stroke(r_pts)
    add_stroke([(540, 150), (575, 200)])
    
    # 'L'
    add_stroke([(600, 100), (600, 200)])
    add_stroke([(600, 200), (640, 200)])
    
    # 'D'
    add_stroke([(660, 100), (660, 200)])
    d_pts = []
    for angle in range(-90, 90, 15):
        rad = math.radians(angle)
        d_pts.append((660 + 35 * math.cos(rad), 150 + 48 * math.sin(rad)))
    add_stroke(d_pts)
    
    return strokes

def render_strokes_to_image(strokes, target_min_height=200, padding=50, stroke_thickness=5):
    """
    Renders strokes onto a normalized white background canvas.
    Computes bounding box, applies scaling and padding, and draws smooth black strokes.
    """
    all_x = []
    all_y = []
    
    for s in strokes:
        pts = s.get("points", [])
        for p in pts:
            all_x.append(p["x"])
            all_y.append(p["y"])
            
    if not all_x or not all_y:
        # Blank canvas fallback
        return np.ones((400, 800, 3), dtype=np.uint8) * 255
        
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    bbox_w = max(max_x - min_x, 10)
    bbox_h = max(max_y - min_y, 10)
    
    # Calculate scale so height is at least target_min_height
    scale = max(target_min_height / bbox_h, 1.5)
    
    canvas_w = int(bbox_w * scale + padding * 2)
    canvas_h = int(bbox_h * scale + padding * 2)
    
    # Create clean white canvas
    img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
    
    for stroke in strokes:
        pts = stroke.get("points", [])
        if len(pts) < 2:
            continue
            
        scaled_pts = []
        for p in pts:
            sx = int((p["x"] - min_x) * scale + padding)
            sy = int((p["y"] - min_y) * scale + padding)
            scaled_pts.append((sx, sy))
            
        for i in range(len(scaled_pts) - 1):
            cv2.line(img, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_thickness, lineType=cv2.LINE_AA)
            
    return img

if __name__ == "__main__":
    strokes = generate_hello_world_strokes()
    img = render_strokes_to_image(strokes)
    
    out_path = os.path.join(debug_dir, "generated_student_handwriting.png")
    cv2.imwrite(out_path, img)
    print(f"Saved generated handwriting image to: {out_path}")
    print(f"Image dimensions: {img.shape}")
    
    # Test EasyOCR recognition
    from app.providers.easyocr_provider import EasyOCRHWRProvider
    provider = EasyOCRHWRProvider()
    res = provider.recognize(img)
    print("=== HWR RESULT ===")
    print(f"Text: '{res.text}'")
    print(f"Confidence: {res.confidence}")
    print(f"Provider: {res.provider}")
    print(f"Lines count: {len(res.lines)}")
