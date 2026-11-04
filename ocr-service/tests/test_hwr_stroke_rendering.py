import sys
import os
import cv2
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.providers.paddle_provider import PaddleHWRProvider

def generate_full_strokes_for_text(text: str):
    strokes = []
    cursor_x = 40.0
    cursor_y = 50.0

    def add_stroke(pts, width=4, color="#0000FF"):
        strokes.append({"points": [{"x": p[0], "y": p[1]} for p in pts], "width": width, "color": color})

    for char in text.upper():
        cx, cy = cursor_x, cursor_y
        w = 40
        h = 70

        if char == "A":
            add_stroke([[cx, cy + h], [cx + w / 2, cy]])
            add_stroke([[cx + w / 2, cy], [cx + w, cy + h]])
            add_stroke([[cx + w * 0.25, cy + h * 0.6], [cx + w * 0.75, cy + h * 0.6]])
            cursor_x += w + 15
        elif char == "B":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx, cy], [cx + w * 0.7, cy], [cx + w * 0.7, cy + h * 0.45], [cx, cy + h * 0.45]])
            add_stroke([[cx, cy + h * 0.45], [cx + w, cy + h * 0.45], [cx + w, cy + h], [cx, cy + h]])
            cursor_x += w + 15
        elif char == "C":
            cPts = []
            for angle in range(45, 316, 15):
                rad = np.radians(angle)
                cPts.append([cx + w / 2 + (w / 2) * np.cos(rad), cy + h / 2 + (h / 2) * np.sin(rad)])
            add_stroke(cPts)
            cursor_x += w + 15
        elif char == "D":
            add_stroke([[cx, cy], [cx, cy + h]])
            dPts = []
            for angle in range(-90, 91, 15):
                rad = np.radians(angle)
                dPts.append([cx + (w * 0.8) * np.cos(rad), cy + h / 2 + (h / 2) * np.sin(rad)])
            add_stroke(dPts)
            cursor_x += w + 20
        elif char == "E":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx, cy], [cx + w, cy]])
            add_stroke([[cx, cy + h / 2], [cx + w * 0.7, cy + h / 2]])
            add_stroke([[cx, cy + h], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "F":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx, cy], [cx + w, cy]])
            add_stroke([[cx, cy + h / 2], [cx + w * 0.7, cy + h / 2]])
            cursor_x += w + 15
        elif char == "G":
            gPts = []
            for angle in range(30, 316, 15):
                rad = np.radians(angle)
                gPts.append([cx + w / 2 + (w / 2) * np.cos(rad), cy + h / 2 + (h / 2) * np.sin(rad)])
            add_stroke(gPts)
            add_stroke([[cx + w / 2, cy + h / 2], [cx + w, cy + h / 2], [cx + w, cy + h * 0.85]])
            cursor_x += w + 20
        elif char == "H":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx + w, cy], [cx + w, cy + h]])
            add_stroke([[cx, cy + h / 2], [cx + w, cy + h / 2]])
            cursor_x += w + 15
        elif char == "I":
            add_stroke([[cx + w * 0.2, cy], [cx + w * 0.8, cy]])
            add_stroke([[cx + w / 2, cy], [cx + w / 2, cy + h]])
            add_stroke([[cx + w * 0.2, cy + h], [cx + w * 0.8, cy + h]])
            cursor_x += w * 0.8 + 15
        elif char == "J":
            add_stroke([[cx + w * 0.2, cy], [cx + w, cy]])
            jPts = [[cx + w * 0.7, cy], [cx + w * 0.7, cy + h * 0.7]]
            for angle in range(0, 181, 20):
                rad = np.radians(angle)
                jPts.append([cx + w * 0.35 + (w * 0.35) * np.cos(rad), cy + h * 0.7 + (h * 0.3) * np.sin(rad)])
            add_stroke(jPts)
            cursor_x += w + 15
        elif char == "K":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx + w, cy], [cx, cy + h / 2]])
            add_stroke([[cx + w * 0.3, cy + h / 2], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "L":
            add_stroke([[cx, cy], [cx, cy + h]])
            add_stroke([[cx, cy + h], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "M":
            add_stroke([[cx, cy + h], [cx, cy], [cx + w / 2, cy + h * 0.6], [cx + w, cy], [cx + w, cy + h]])
            cursor_x += w + 20
        elif char == "N":
            add_stroke([[cx, cy + h], [cx, cy], [cx + w, cy + h], [cx + w, cy]])
            cursor_x += w + 15
        elif char == "O":
            oPts = []
            for angle in range(0, 361, 15):
                rad = np.radians(angle)
                oPts.append([cx + w / 2 + (w / 2) * np.cos(rad), cy + h / 2 + (h / 2) * np.sin(rad)])
            add_stroke(oPts)
            cursor_x += w + 20
        elif char == "P":
            add_stroke([[cx, cy], [cx, cy + h]])
            pPts = []
            for angle in range(-90, 91, 20):
                rad = np.radians(angle)
                pPts.append([cx + (w * 0.7) * np.cos(rad), cy + h * 0.25 + (h * 0.25) * np.sin(rad)])
            add_stroke(pPts)
            cursor_x += w + 15
        elif char == "Q":
            qPts = []
            for angle in range(0, 361, 15):
                rad = np.radians(angle)
                qPts.append([cx + w / 2 + (w / 2) * np.cos(rad), cy + h / 2 + (h / 2) * np.sin(rad)])
            add_stroke(qPts)
            add_stroke([[cx + w * 0.5, cy + h * 0.6], [cx + w * 0.9, cy + h * 0.95]])
            cursor_x += w + 20
        elif char == "R":
            add_stroke([[cx, cy], [cx, cy + h]])
            rPts = []
            for angle in range(-90, 91, 20):
                rad = np.radians(angle)
                rPts.append([cx + (w * 0.7) * np.cos(rad), cy + h * 0.25 + (h * 0.25) * np.sin(rad)])
            add_stroke(rPts)
            add_stroke([[cx, cy + h * 0.5], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "S":
            sPts = [
                [cx + w * 0.8, cy + h * 0.15],
                [cx + w * 0.3, cy],
                [cx, cy + h * 0.25],
                [cx + w * 0.5, cy + h * 0.5],
                [cx + w, cy + h * 0.75],
                [cx + w * 0.7, cy + h],
                [cx + w * 0.1, cy + h * 0.85]
            ]
            add_stroke(sPts)
            cursor_x += w + 15
        elif char == "T":
            add_stroke([[cx, cy], [cx + w, cy]])
            add_stroke([[cx + w / 2, cy], [cx + w / 2, cy + h]])
            cursor_x += w + 15
        elif char == "U":
            uPts = [[cx, cy], [cx, cy + h * 0.65]]
            for angle in range(180, 361, 20):
                rad = np.radians(angle)
                uPts.append([cx + w / 2 + (w / 2) * np.cos(rad), cy + h * 0.65 - (h * 0.35) * np.sin(rad)])
            uPts.append([cx + w, cy])
            add_stroke(uPts)
            cursor_x += w + 15
        elif char == "V":
            add_stroke([[cx, cy], [cx + w / 2, cy + h], [cx + w, cy]])
            cursor_x += w + 15
        elif char == "W":
            add_stroke([[cx, cy], [cx + w * 0.25, cy + h], [cx + w * 0.5, cy + h * 0.3], [cx + w * 0.75, cy + h], [cx + w, cy]])
            cursor_x += w + 20
        elif char == "X":
            add_stroke([[cx, cy], [cx + w, cy + h]])
            add_stroke([[cx + w, cy], [cx, cy + h]])
            cursor_x += w + 15
        elif char == "Y":
            add_stroke([[cx, cy], [cx + w / 2, cy + h * 0.4]])
            add_stroke([[cx + w, cy], [cx + w / 2, cy + h * 0.4]])
            add_stroke([[cx + w / 2, cy + h * 0.4], [cx + w / 2, cy + h]])
            cursor_x += w + 15
        elif char == "Z":
            add_stroke([[cx, cy], [cx + w, cy], [cx, cy + h], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "1":
            add_stroke([[cx + w * 0.2, cy + h * 0.2], [cx + w / 2, cy], [cx + w / 2, cy + h]])
            add_stroke([[cx + w * 0.1, cy + h], [cx + w * 0.9, cy + h]])
            cursor_x += w + 15
        elif char == "2":
            add_stroke([[cx + w * 0.1, cy + h * 0.2], [cx + w * 0.5, cy], [cx + w, cy + h * 0.3], [cx, cy + h], [cx + w, cy + h]])
            cursor_x += w + 15
        elif char == "3":
            add_stroke([[cx, cy], [cx + w, cy], [cx + w / 2, cy + h * 0.45], [cx + w, cy + h * 0.7], [cx + w * 0.2, cy + h]])
            cursor_x += w + 15
        elif char == " ":
            cursor_x += 35
        else:
            add_stroke([[cx, cy], [cx + w, cy], [cx + w, cy + h], [cx, cy + h], [cx, cy]])
            cursor_x += w + 15

    return strokes

def render_strokes_optimized(strokes, target_height=100, line_thickness=6, padding=50):
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

    scale = max(target_height / bbox_h, 1.0)
    canvas_w = int(bbox_w * scale + padding * 2)
    canvas_h = int(bbox_h * scale + padding * 2)

    img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
    stroke_w = max(int(round(line_thickness * (scale ** 0.5))), 4)

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
        "PROCESS MANAGEMENT PCB SCHEDULING CONTEXT SWITCH",
        "TCP CONNECTION RELIABLE UDP CONNECTIONLESS FAST",
        "NORMALIZATION DBMS REDUNDANCY 1NF 2NF 3NF ANOMALIES"
    ]
    
    provider = PaddleHWRProvider()
    
    for i, t in enumerate(texts, 1):
        strokes = generate_full_strokes_for_text(t)
        img = render_strokes_optimized(strokes, target_height=120, line_thickness=5, padding=40)
        
        debug_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../debug"))
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(os.path.join(debug_dir, f"test_full_{i}.png"), img)
        
        res = provider.recognize(img)
        print(f"--- Q{i} ---")
        print(f"  Target Text:     '{t}'")
        print(f"  Recognized Text: '{res.text}'")
        print(f"  Confidence:      {res.confidence}")
        print(f"  Lines:           {[l.text for l in res.lines]}\n")
