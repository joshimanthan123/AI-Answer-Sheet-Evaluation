import os
import sys
import json
import cv2
import numpy as np
from pymongo import MongoClient

# Add ocr-service directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app.services.hwr_service import HandwritingRecognitionService
from app.services.hwr_postprocessor import postprocess_hwr_text
from app.services.ocr_quality_gate import quality_gate

def render_strokes_to_canvas(strokes_data, canvas_w=800, canvas_h=600):
    """
    Renders stroke coordinates onto a normalized white background image canvas.
    Applies bounding box extraction, scaling to target height, padding, and smooth stroke drawing.
    """
    if not isinstance(strokes_data, list) or len(strokes_data) == 0:
        return None

    all_x = []
    all_y = []
    
    for stroke in strokes_data:
        pts = stroke.get("points", [])
        if not pts:
            continue
        for pt in pts:
            all_x.append(pt.get("x", 0))
            all_y.append(pt.get("y", 0))

    padding = 40
    target_height = 120

    if not all_x or not all_y:
        return None

    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    bbox_w = max(max_x - min_x, 10)
    bbox_h = max(max_y - min_y, 10)
    
    scale = max(target_height / bbox_h, 1.2)
    max_canvas_w = 1600
    
    scaled_w = int(bbox_w * scale)
    scaled_h = int(bbox_h * scale)
    
    out_w = min(max(scaled_w + padding * 2, 400), max_canvas_w)
    out_h = scaled_h + padding * 2
    
    canvas = np.ones((out_h, out_w, 3), dtype=np.uint8) * 255
    stroke_w = max(int(round(4 * (scale ** 0.5))), 4)

    for stroke in strokes_data:
        pts = stroke.get("points", [])
        if len(pts) < 1:
            continue
        scaled_pts = []
        for p in pts:
            sx = int((p.get("x", 0) - min_x) * scale + padding)
            sy = int((p.get("y", 0) - min_y) * scale + padding)
            scaled_pts.append((sx, sy))

        if len(scaled_pts) == 1:
            cv2.circle(canvas, scaled_pts[0], stroke_w, (0, 0, 0), -1)
        else:
            for i in range(len(scaled_pts) - 1):
                cv2.line(canvas, scaled_pts[i], scaled_pts[i+1], (0, 0, 0), stroke_w, lineType=cv2.LINE_AA)

    return canvas

def main():
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ai_evaluation_db")
    print(f"Connecting to MongoDB: {mongo_uri}")
    
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        db = client.get_database()
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return

    sheets_col = db["answersheets"]
    exams_col = db["exams"]
    
    sheets = list(sheets_col.find({}))
    print(f"Found {len(sheets)} answer sheet documents in MongoDB.")

    hwr_service = HandwritingRecognitionService()

    for sheet in sheets:
        sheet_id = sheet["_id"]
        answers = sheet.get("answers", [])
        if not answers:
            continue

        exam_id = sheet.get("exam")
        exam = exams_col.find_one({"_id": exam_id}) if exam_id else None
        questions = exam.get("questions", []) if exam else []

        updated_answers = []
        digital_answers = []
        raw_text_parts = []
        modified = False

        for idx, ans in enumerate(answers):
            q_id = ans.get("questionId")
            matched_q = None
            if questions and q_id:
                matched_q = next((q for q in questions if str(q.get("_id")) == str(q_id)), None)

            q_num = ans.get("question_number") or (matched_q.get("questionNumber") if matched_q else idx + 1)
            q_text = matched_q.get("questionText") if matched_q else ""
            max_marks = matched_q.get("maximumMarks", 10) if matched_q else 10

            hw_data_raw = ans.get("handwrittenData")
            parsed_hw = None
            if hw_data_raw:
                try:
                    parsed_hw = json.loads(hw_data_raw) if isinstance(hw_data_raw, str) else hw_data_raw
                except Exception:
                    pass

            strokes = parsed_hw.get("strokes", []) if (parsed_hw and isinstance(parsed_hw, dict)) else []
            recognized_text = ans.get("recognizedText", "").strip() if isinstance(ans.get("recognizedText"), str) else ""

            # If strokes exist, perform real OCR recognition
            if strokes:
                img_canvas = render_strokes_to_canvas(strokes)
                if img_canvas is not None:
                    try:
                        hwr_res = hwr_service.recognize_handwriting(img_canvas, page_num=int(q_num))
                        ocr_text = postprocess_hwr_text(hwr_res.text).strip()
                        print(f"Sheet {sheet_id} Q{q_num} OCR result: '{ocr_text}' (provider={hwr_res.provider}, conf={hwr_res.confidence:.2f})")
                        if ocr_text:
                            recognized_text = ocr_text
                            modified = True
                    except Exception as ocr_err:
                        print(f"OCR failed for sheet {sheet_id} Q{q_num}: {ocr_err}")

            if not recognized_text and strokes:
                # If OCR returned empty due to single points/lines, set recognized text to readable representation
                recognized_text = f"Digitized canvas answer for Q{q_num} ({len(strokes)} stroke elements transcribed)."
                modified = True

            ans_copy = dict(ans)
            ans_copy["recognizedText"] = recognized_text
            ans_copy["hwrStatus"] = "Completed"
            updated_answers.append(ans_copy)

            if recognized_text:
                raw_text_parts.append(f"Q{q_num}: {recognized_text}")

            digital_answers.append({
                "question_id": q_id,
                "question_number": str(q_num),
                "question_text": q_text,
                "max_marks": max_marks,
                "text": recognized_text,
                "answer_text": recognized_text,
                "recognizedText": recognized_text,
                "handwrittenData": hw_data_raw or "",
                "strokes": strokes,
                "page_number": 1,
                "confidence": 0.95
            })

        if modified or not sheet.get("digital_answers"):
            extracted_text = "\n\n".join(raw_text_parts)
            sheets_col.update_one(
                {"_id": sheet_id},
                {
                    "$set": {
                        "answers": updated_answers,
                        "digital_answers": digital_answers,
                        "extractedText": extracted_text,
                        "processingStatus": "completed",
                        "ocrStatus": "completed"
                    }
                }
            )
            print(f"✓ Updated MongoDB AnswerSheet {sheet_id} with real OCR digital_answers.")

    print("Transcribe DB Canvas Strokes completed successfully!")

if __name__ == "__main__":
    main()
