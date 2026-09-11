import sys
import os
import cv2
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.providers.paddle_provider import PaddleHWRProvider
from app.services.ocr_quality_gate import quality_gate
from tests.test_hwr_stroke_rendering import generate_full_strokes_for_text

def run_real_handwriting_test():
    print("=========================================================================")
    print("          REAL HANDWRITING RECOGNITION & QUALITY GATE TEST               ")
    print("=========================================================================\n")

    test_questions = [
        ("Q1", "PROCESS MANAGEMENT PCB SCHEDULING CONTEXT SWITCH"),
        ("Q2", "TCP CONNECTION RELIABLE UDP CONNECTIONLESS FAST"),
        ("Q3", "NORMALIZATION DBMS REDUNDANCY 1NF 2NF 3NF ANOMALIES")
    ]

    provider = PaddleHWRProvider()
    debug_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../debug"))
    os.makedirs(debug_dir, exist_ok=True)

    all_passed = True

    for q_label, text in test_questions:
        strokes = generate_full_strokes_for_text(text)
        
        # Render image
        all_x, all_y = [], []
        for s in strokes:
            for p in s["points"]:
                all_x.append(p["x"])
                all_y.append(p["y"])

        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)
        bbox_w = max(max_x - min_x, 10)
        bbox_h = max(max_y - min_y, 10)

        scale = max(100 / bbox_h, 1.0)
        padding = 40
        canvas_w = min(max(int(bbox_w * scale + padding * 2), 400), 1600)
        canvas_h = int(bbox_h * scale + padding * 2)

        img = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
        stroke_w = max(int(round(4 * (scale ** 0.5))), 4)

        for s in strokes:
            pts = s["points"]
            if len(pts) < 2:
                continue
            scaled_pts = [(int((p["x"] - min_x) * scale + padding), int((p["y"] - min_y) * scale + padding)) for p in pts]
            for i in range(len(scaled_pts) - 1):
                cv2.line(img, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_w, lineType=cv2.LINE_AA)

        cv2.imwrite(os.path.join(debug_dir, f"{q_label}_rendered.png"), img)

        res = provider.recognize(img)
        qg_res = quality_gate.evaluate(res.text, res.confidence, res.lines)

        print(f"--- {q_label} ---")
        print(f"Input Text:       '{text}'")
        print(f"Stroke Count:     {len(strokes)}")
        print(f"Image Dimensions: {img.shape[1]}x{img.shape[0]}")
        print(f"Provider:         {res.provider}")
        print(f"Recognized Text:  '{res.text}'")
        print(f"Confidence:       {res.confidence:.4f}")
        print(f"Quality Status:   {qg_res.ocrQualityStatus}")
        print(f"Needs Review:     {qg_res.needsReview}")
        print(f"Processing Time:  {res.execution_time:.4f}s\n")

        if not res.text or res.confidence < 0.5:
            all_passed = False

    print("=========================================================================")
    print(f"VERDICT: {'PASS' if all_passed else 'FAIL'}")
    print("=========================================================================")

if __name__ == "__main__":
    run_real_handwriting_test()
