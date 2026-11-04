import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json
import warnings

# Suppress Python warnings from leaking into stdout
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ['PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT'] = '0'
os.environ['FLAGS_use_onednn'] = '0'
os.environ['FLAGS_use_mkldnn'] = '0'

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        return

    file_path = sys.argv[1]
    if not os.path.isabs(file_path):
        file_path = os.path.abspath(file_path)

    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}))
        return

    text_lines = []
    answers_list = []
    page_texts = []
    ext = os.path.splitext(file_path)[1].lower()

    def is_readable_text(text: str) -> bool:
        if not text or not text.strip():
            return False
        clean = text.strip()
        words = clean.split()
        if len(words) < 2 and len(clean) < 10:
            return False
        printable_count = sum(1 for c in clean if c.isalnum() or c.isspace() or c in ".,!?:;-_()[]{}\"'/$%&")
        if printable_count / len(clean) < 0.75:
            return False
        avg_word_len = sum(len(w) for w in words) / len(words)
        if avg_word_len < 1.5 or avg_word_len > 25:
            return False
        return True

    # 1. Try PyMuPDF if file is a PDF
    if ext == ".pdf":
        try:
            import fitz
            from app.models.hwr_models import HWRResult, HWRLine
            from app.services.segmentation_service import AnswerSegmentationService

            doc = fitz.open(file_path)
            has_readable = False
            page_results = []

            for page_idx, page in enumerate(doc):
                t = page.get_text()
                if t and is_readable_text(t):
                    has_readable = True
                    page_texts.append(t.strip())
                    lines = [HWRLine(text=l.strip(), confidence=1.0) for l in t.splitlines() if l.strip()]
                    for l in lines:
                        text_lines.append(l.text)
                    page_results.append(HWRResult(text=t.strip(), confidence=1.0, lines=lines, provider="pymupdf", execution_time=0.01))

            if has_readable and page_results:
                seg_res = AnswerSegmentationService.segment_answers(page_results)
                if seg_res and seg_res.answers:
                    for ans in seg_res.answers:
                        answers_list.append({
                            "question_number": ans.question_number,
                            "normalized_question_number": ans.normalized_question_number,
                            "answer_text": ans.answer_text,
                            "confidence": ans.confidence,
                            "page_number": ans.metadata.page_start
                        })
            elif not has_readable:
                # Scanned PDF without readable text layer: render pages to images and run real OCR (Textract)
                try:
                    import cv2
                    import numpy as np
                    from app.providers.textract_provider import TextractHWRProvider

                    tp = TextractHWRProvider()
                    ocr_page_results = []
                    for page_idx, page in enumerate(doc):
                        pix = page.get_pixmap(dpi=150)
                        png_bytes = pix.tobytes("png")
                        nparr = np.frombuffer(png_bytes, np.uint8)
                        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if cv_img is not None:
                            hwr_res = tp.recognize(cv_img, page_num=page_idx + 1)
                            ocr_page_results.append(hwr_res)
                            page_texts.append(hwr_res.text)
                            for l in hwr_res.lines:
                                text_lines.append(l.text)

                    if ocr_page_results:
                        seg_res = AnswerSegmentationService.segment_answers(ocr_page_results)
                        if seg_res and seg_res.answers:
                            for ans in seg_res.answers:
                                answers_list.append({
                                    "question_number": ans.question_number,
                                    "normalized_question_number": ans.normalized_question_number,
                                    "answer_text": ans.answer_text,
                                    "confidence": ans.confidence,
                                    "page_number": ans.metadata.page_start
                                })
                except Exception as ocr_e:
                    sys.stderr.write(f"Scanned PDF OCR error: {ocr_e}\n")
        except Exception as e:
            sys.stderr.write(f"PyMuPDF error: {e}\n")

    # 2. Try configured HWR provider (Textract/PaddleOCR/etc.) for image formats
    if not text_lines and ext != ".pdf":
        try:
            from app.utils.image_utils import load_image
            from app.services.hwr_service import HandwritingRecognitionService
            from app.services.segmentation_service import AnswerSegmentationService

            img = load_image(file_path)
            provider = HandwritingRecognitionService.get_provider()
            hwr_res = provider.recognize(img)
            
            if hwr_res and hwr_res.lines:
                for line in hwr_res.lines:
                    if line.text and line.text.strip():
                        text_lines.append(line.text.strip())

            seg_res = AnswerSegmentationService.segment_answers(hwr_res)
            if seg_res and seg_res.answers:
                for ans in seg_res.answers:
                    answers_list.append({
                        "question_number": ans.question_number,
                        "normalized_question_number": ans.normalized_question_number,
                        "answer_text": ans.answer_text,
                        "confidence": ans.confidence,
                        "page_number": 1
                    })
        except Exception as e:
            sys.stderr.write(f"HWR recognition error: {e}\n")

    # Output ONLY valid JSON on stdout
    sys.stdout.write(json.dumps({
        "success": True,
        "lines": text_lines,
        "pages": page_texts,
        "answers": answers_list
    }) + "\n")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
