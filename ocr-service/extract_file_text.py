import sys
import os
import json
import warnings

# Suppress Python warnings from leaking into stdout
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

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
    ext = os.path.splitext(file_path)[1].lower()

    # 1. Try PyMuPDF if file is a PDF
    if ext == ".pdf":
        try:
            import fitz
            doc = fitz.open(file_path)
            for page in doc:
                t = page.get_text()
                if t and t.strip():
                    for line in t.splitlines():
                        clean = line.strip()
                        if clean:
                            text_lines.append(clean)
        except Exception as e:
            sys.stderr.write(f"PyMuPDF error: {e}\n")

    # 2. Try EasyOCR for image formats or if PDF had no embedded text layer
    if not text_lines:
        try:
            import easyocr
            reader = easyocr.Reader(['en'], gpu=False)
            results = reader.readtext(file_path, detail=1)
            if results:
                results.sort(key=lambda item: (item[0][0][1], item[0][0][0]))
                for bbox, text, prob in results:
                    clean = text.strip()
                    if clean:
                        text_lines.append(clean)
        except Exception as e:
            sys.stderr.write(f"EasyOCR error: {e}\n")

    # Output ONLY valid JSON on stdout
    sys.stdout.write(json.dumps({"success": True, "lines": text_lines}) + "\n")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
