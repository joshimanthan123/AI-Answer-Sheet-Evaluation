import sys
import os
import cv2
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.providers.paddle_provider import PaddleHWRProvider
from tests.test_hwr_stroke_rendering import generate_full_strokes_for_text

def render_strokes_multiline(strokes, max_canvas_w=1400, target_line_h=70, padding=40):
    all_x, all_y = [], []
    for s in strokes:
        for p in s["points"]:
            all_x.append(p["x"])
            all_y.append(p["y"])
    
    if not all_x:
        return np.ones((200, 400, 3), dtype=np.uint8) * 255

    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    bbox_w = max(max_x - min_x, 10)
    bbox_h = max(max_y - min_y, 10)

    # Scale stroke height to target_line_h
    scale = max(target_line_h / bbox_h, 1.0)
    scaled_w = int(bbox_w * scale)
    scaled_h = int(bbox_h * scale)

    canvas_w = min(max(scaled_w + padding * 2, 600), max_canvas_w)
    canvas_h = scaled_h + padding * 2

    img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
    stroke_w = max(int(round(4 * scale)), 4)

    for s in strokes:
        pts = s["points"]
        if len(pts) < 2:
            continue
        scaled_pts = []
        for p in pts:
            sx = int((p["x"] - min_x) * scale + padding)
            sy = int((p["y"] - min_y) * scale + padding)
            scaled_pts.append((sx, sy))
        for i in range(len(scaled_pts) - 1):
            cv2.line(img, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_w, lineType=cv2.LINE_AA)
            
    return img

if __name__ == "__main__":
    texts = [
        "PROCESS MANAGEMENT PCB",
        "SCHEDULING CONTEXT SWITCH",
        "TCP CONNECTION RELIABLE",
        "UDP CONNECTIONLESS FAST",
        "NORMALIZATION DBMS REDUNDANCY",
        "1NF 2NF 3NF ANOMALIES"
    ]
    
    provider = PaddleHWRProvider()
    
    for i, t in enumerate(texts, 1):
        strokes = generate_full_strokes_for_text(t)
        img = render_strokes_multiline(strokes, max_canvas_w=1400, target_line_h=70, padding=40)
        
        debug_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../debug"))
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(os.path.join(debug_dir, f"test_line_{i}.png"), img)
        
        res = provider.recognize(img)
        print(f"--- Line {i} ({img.shape[1]}x{img.shape[0]}) ---")
        print(f"  Target:     '{t}'")
        print(f"  Recognized: '{res.text}'")
        print(f"  Confidence: {res.confidence}\n")
