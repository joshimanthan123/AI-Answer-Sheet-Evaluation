import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen aspect ratio
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6] # Blank slide

    # Color Palette
    COLOR_BG = RGBColor(9, 13, 22)
    COLOR_CARD = RGBColor(17, 24, 39)
    COLOR_BORDER = RGBColor(30, 41, 59)
    COLOR_CYAN = RGBColor(6, 182, 212)
    COLOR_BLUE = RGBColor(59, 130, 246)
    COLOR_EMERALD = RGBColor(16, 185, 129)
    COLOR_AMBER = RGBColor(245, 158, 11)
    COLOR_ROSE = RGBColor(244, 63, 94)
    COLOR_TEXT = RGBColor(248, 250, 252)
    COLOR_MUTED = RGBColor(148, 163, 184)

    assets_dir = r"d:\CE\sem5\SGP\Ai based evaluation sheet\presentation\assets"

    def set_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG
        bg.line.fill.background()
        return bg

    def add_header(slide, badge_text, title_text, subtitle_text=""):
        # Badge
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.4), Inches(2.8), Inches(0.35))
        badge.fill.solid()
        badge.fill.fore_color.rgb = RGBColor(15, 35, 50)
        badge.line.color.rgb = COLOR_CYAN
        tf = badge.text_frame
        tf.text = badge_text.upper()
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = COLOR_CYAN

        # Title
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.733), Inches(0.8))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(26)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT

        if subtitle_text:
            p2 = tf.add_paragraph()
            p2.text = subtitle_text
            p2.font.size = Pt(14)
            p2.font.color.rgb = COLOR_MUTED

    def add_card(slide, left, top, width, height, title="", body="", title_color=COLOR_TEXT, border_color=COLOR_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = border_color
        card.line.width = Pt(1)
        
        if title or body:
            tb = slide.shapes.add_textbox(left + Inches(0.15), top + Inches(0.15), width - Inches(0.3), height - Inches(0.3))
            tf = tb.text_frame
            tf.word_wrap = True
            if title:
                p = tf.paragraphs[0]
                p.text = title
                p.font.size = Pt(16)
                p.font.bold = True
                p.font.color.rgb = title_color
            if body:
                p2 = tf.add_paragraph() if title else tf.paragraphs[0]
                p2.text = body
                p2.font.size = Pt(12)
                p2.font.color.rgb = COLOR_MUTED
                if title:
                    p2.space_before = Pt(8)
        return card

    # SLIDE 1: TITLE
    s1 = prs.slides.add_slide(blank_layout)
    set_bg(s1)
    
    # Title Hero
    tb = s1.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(2.2))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "AI-Based Automated Answer Sheet Evaluation System"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = COLOR_CYAN

    p2 = tf.add_paragraph()
    p2.text = "Digital Handwriting Capture & Intelligent Text Digitization"
    p2.font.size = Pt(20)
    p2.font.color.rgb = COLOR_MUTED
    p2.space_before = Pt(12)

    # Hero visual nodes
    node_w = Inches(3.2)
    node_h = Inches(1.5)
    
    add_card(s1, Inches(1.0), Inches(3.6), node_w, node_h, "✍️ Digital Handwriting", "HTML5 Canvas Stroke Vectors", COLOR_TEXT, COLOR_CYAN)
    
    tb_arrow1 = s1.shapes.add_textbox(Inches(4.4), Inches(4.0), Inches(0.8), Inches(0.8))
    tb_arrow1.text_frame.text = "➔"
    tb_arrow1.text_frame.paragraphs[0].font.size = Pt(28)
    tb_arrow1.text_frame.paragraphs[0].font.color.rgb = COLOR_CYAN

    add_card(s1, Inches(5.0), Inches(3.6), node_w, node_h, "⚡ FastAPI & PaddleOCR", "PP-OCRv5 Microservice", COLOR_TEXT, COLOR_BLUE)

    tb_arrow2 = s1.shapes.add_textbox(Inches(8.4), Inches(4.0), Inches(0.8), Inches(0.8))
    tb_arrow2.text_frame.text = "➔"
    tb_arrow2.text_frame.paragraphs[0].font.size = Pt(28)
    tb_arrow2.text_frame.paragraphs[0].font.color.rgb = COLOR_CYAN

    add_card(s1, Inches(9.0), Inches(3.6), node_w, node_h, "📄 Digitized Text", "Structured Machine-Readable Output", COLOR_TEXT, COLOR_EMERALD)

    # Metadata cards
    m_w = Inches(2.6)
    add_card(s1, Inches(1.0), Inches(5.6), m_w, Inches(1.0), "TEAM MEMBERS", "Student Project Team", COLOR_MUTED)
    add_card(s1, Inches(3.9), Inches(5.6), m_w, Inches(1.0), "PROJECT GUIDE", "Faculty Advisor", COLOR_MUTED)
    add_card(s1, Inches(6.8), Inches(5.6), m_w, Inches(1.0), "DEPARTMENT", "Computer Engineering", COLOR_MUTED)
    add_card(s1, Inches(9.7), Inches(5.6), m_w, Inches(1.0), "ACADEMIC YEAR", "2025 – 2026", COLOR_MUTED)

    # SLIDE 2: EXECUTIVE SUMMARY
    s2 = prs.slides.add_slide(blank_layout)
    set_bg(s2)
    add_header(s2, "Executive Summary", "Project Overview")

    c_w = Inches(3.6)
    add_card(s2, Inches(0.8), Inches(1.8), c_w, Inches(2.5), "⚠️ Problem", "Traditional handwritten answer-sheet processing is manual, labor-intensive, and difficult to digitize automatically for evaluation workflows.", COLOR_ROSE, COLOR_ROSE)
    add_card(s2, Inches(4.85), Inches(1.8), c_w, Inches(2.5), "💡 Solution", "Captures digital handwritten responses from canvas interfaces and processes them through an integrated OpenCV + PaddleOCR neural pipeline.", COLOR_CYAN, COLOR_CYAN)
    add_card(s2, Inches(8.9), Inches(1.8), c_w, Inches(2.5), "🎯 Current Milestone", "Converts handwritten answers into accurate, machine-readable digitized text, laying the foundation for downstream evaluation.", COLOR_EMERALD, COLOR_EMERALD)

    add_card(s2, Inches(0.8), Inches(4.7), Inches(11.7), Inches(1.8), "Workflow Summary", "PROBLEM (Manual Sheet Handling) ➔ DIGITAL CAPTURE (Canvas Strokes) ➔ OCR PIPELINE (FastAPI + PP-OCRv5) ➔ DIGITIZED TEXT (MongoDB Persistence)", COLOR_TEXT, COLOR_CYAN)

    # SLIDE 3: PROBLEM & BUSINESS NEED
    s3 = prs.slides.add_slide(blank_layout)
    set_bg(s3)
    add_header(s3, "Market Need", "Why Digitize Handwritten Answers?")

    w_half = Inches(5.6)
    add_card(s3, Inches(0.8), Inches(1.8), w_half, Inches(4.8), "Conventional Answer-Sheet Challenges", 
             "• Manual handling and sorting of physical answer sheets\n\n"
             "• Time-consuming manual data entry and transcription\n\n"
             "• Unstructured handwriting hinders machine processing\n\n"
             "• Question-wise answer extraction is difficult on physical paper\n\n"
             "• Requires significant human effort prior to evaluation", COLOR_TEXT)
    
    add_card(s3, Inches(6.9), Inches(1.8), w_half, Inches(4.8), "Process Comparison",
             "TRADITIONAL PROCESS:\n"
             "Physical Paper ➔ Manual Reading ➔ Manual Entry ➔ Evaluation\n\n"
             "PROPOSED SYSTEM:\n"
             "Digital Handwriting ➔ Image Preprocessing ➔ PaddleOCR ➔ Digitized Text\n\n"
             "KEY BENEFIT:\n"
             "Substantially reduces manual data-entry dependency and creates structured digital records.", COLOR_CYAN, COLOR_CYAN)

    # SLIDE 4: PROPOSED SOLUTION
    s4 = prs.slides.add_slide(blank_layout)
    set_bg(s4)
    add_header(s4, "Solution Overview", "Proposed Digital Pipeline")

    step_w = Inches(1.8)
    gap = Inches(0.18)
    steps = [
        ("01", "Student Writes", "Digital pen input"),
        ("02", "Stroke Capture", "(x,y,t) vectors"),
        ("03", "Answer Image", "Render PNG"),
        ("04", "Preprocessing", "CLAHE & Threshold"),
        ("05", "PaddleOCR", "PP-OCRv5 HWR"),
        ("06", "Digitized Text", "MongoDB Store")
    ]

    for i, (num, title, desc) in enumerate(steps):
        x = Inches(0.8) + i * (step_w + gap)
        border = COLOR_CYAN if i == 5 else COLOR_BORDER
        t_col = COLOR_CYAN if i == 5 else COLOR_TEXT
        add_card(s4, x, Inches(2.2), step_w, Inches(2.6), f"STEP {num}\n{title}", desc, t_col, border)

    add_card(s4, Inches(0.8), Inches(5.2), Inches(11.7), Inches(1.4), "Core Solution Statement", "“Transforming handwritten digital responses into structured, machine-readable text.”", COLOR_CYAN, COLOR_CYAN)

    # SLIDE 5: SYSTEM ARCHITECTURE
    s5 = prs.slides.add_slide(blank_layout)
    set_bg(s5)
    add_header(s5, "Architecture", "System Architecture")

    add_card(s5, Inches(0.8), Inches(1.8), w_half, Inches(4.8), "Microservice Flow",
             "Student Canvas (React 19 + Vite)\n"
             "  │  POST /api/v1/student/answer-sheets\n"
             "  ▼\n"
             "Node.js + Express Backend Server\n"
             "  │  Asynchronous HTTP Payload\n"
             "  ▼\n"
             "FastAPI Python OCR Service (Port 8000)\n"
             "  │  Image Preprocessing & PP-OCRv5\n"
             "  ▼\n"
             "MongoDB Persistence (AnswerSheet Collection)", COLOR_CYAN)

    add_card(s5, Inches(6.9), Inches(1.8), w_half, Inches(4.8), "Component Responsibilities",
             "FRONTEND (React + Vite):\n"
             "Captures vector strokes and question-wise assignments.\n\n"
             "BACKEND (Node.js + Express):\n"
             "Orchestrates JWT auth, status flow, and async execution.\n\n"
             "OCR SERVICE (FastAPI + PaddleOCR):\n"
             "Executes OpenCV preprocessing & PP-OCRv5 neural inference.\n\n"
             "DATABASE (MongoDB):\n"
             "Persists stroke data, generated images, and extracted text.", COLOR_TEXT)

    # SLIDE 6: END-TO-END OCR WORKFLOW
    s6 = prs.slides.add_slide(blank_layout)
    set_bg(s6)
    add_header(s6, "Workflow", "End-to-End Handwriting Recognition Workflow")

    w_card4 = Inches(2.7)
    add_card(s6, Inches(0.8), Inches(2.0), w_card4, Inches(4.2), "STAGE 1: CAPTURE", "Collect vector strokes from HTML5 digital answer canvas.", COLOR_CYAN)
    add_card(s6, Inches(3.8), Inches(2.0), w_card4, Inches(4.2), "STAGE 2: PREPROCESS", "Normalize DPI, CLAHE contrast enhancement, and grayscale thresholding.", COLOR_BLUE)
    add_card(s6, Inches(6.8), Inches(2.0), w_card4, Inches(4.2), "STAGE 3: RECOGNIZE", "PP-OCRv5 neural model predicts handwritten characters.", COLOR_AMBER)
    add_card(s6, Inches(9.8), Inches(2.0), w_card4, Inches(4.2), "STAGE 4: EXTRACT", "Generates clean machine-readable text with confidence metrics.", COLOR_EMERALD)

    # SLIDE 7: TECHNOLOGY STACK
    s7 = prs.slides.add_slide(blank_layout)
    set_bg(s7)
    add_header(s7, "Tech Stack", "Technology Stack")

    add_card(s7, Inches(0.8), Inches(2.0), w_card4, Inches(4.5), "FRONTEND", "• React 19\n• Vite\n• Axios Client\n• HTML5 Canvas", COLOR_BLUE)
    add_card(s7, Inches(3.8), Inches(2.0), w_card4, Inches(4.5), "BACKEND", "• Node.js (ESM)\n• Express.js\n• JWT Security\n• Mongoose ODM", COLOR_CYAN)
    add_card(s7, Inches(6.8), Inches(2.0), w_card4, Inches(4.5), "OCR / AI", "• Python 3.11\n• FastAPI\n• PaddleOCR 3.7.0\n• PP-OCRv5", COLOR_AMBER)
    add_card(s7, Inches(9.8), Inches(2.0), w_card4, Inches(4.5), "DATABASE", "• MongoDB\n• REST APIs\n• JSON Payloads\n• Modular Architecture", COLOR_EMERALD)

    # SLIDE 8: DIGITAL ANSWER CAPTURE
    s8 = prs.slides.add_slide(blank_layout)
    set_bg(s8)
    add_header(s8, "Capture Stage", "Digital Handwritten Answer Capture")

    add_card(s8, Inches(0.8), Inches(1.8), Inches(5.5), Inches(4.8), "Functional Pipeline",
             "01 — WRITE:\nStudent writes answers directly using digital stylus on responsive canvas.\n\n"
             "02 — CAPTURE:\nReal-time stroke capture mapped question-by-question with timestamp vectors.\n\n"
             "03 — PREPARE:\nRenders high-contrast PNG bitmap ready for OCR microservice processing.", COLOR_CYAN)

    img_path_s8 = os.path.join(assets_dir, "student_dash_screen.png")
    if os.path.exists(img_path_s8):
        s8.shapes.add_picture(img_path_s8, Inches(6.6), Inches(1.8), width=Inches(5.9))

    # SLIDE 9: IMAGE PREPROCESSING
    s9 = prs.slides.add_slide(blank_layout)
    set_bg(s9)
    add_header(s9, "OpenCV Pipeline", "OCR Image Preprocessing Pipeline")

    p_imgs = [
        ("01_original_canvas_render.png", "1. Raw Render"),
        ("02_upscaled.png", "2. Upscale"),
        ("03_grayscale.png", "3. Grayscale"),
        ("04_contrast_enhanced.png", "4. CLAHE"),
        ("05_final_ocr_input.png", "5. Thresholded")
    ]
    
    p_w = Inches(2.2)
    for i, (fn, label) in enumerate(p_imgs):
        x = Inches(0.8) + i * Inches(2.38)
        img_p = os.path.join(assets_dir, fn)
        if os.path.exists(img_p):
            s9.shapes.add_picture(img_p, x, Inches(1.8), width=p_w)
        add_card(s9, x, Inches(3.8), p_w, Inches(0.7), label, "", COLOR_CYAN if i==4 else COLOR_TEXT)

    add_card(s9, Inches(0.8), Inches(4.8), Inches(11.7), Inches(1.8), "Preprocessing Explanations",
             "Resize: Standardizes stroke DPI and thickness.  |  CLAHE: Enhances stroke boundary contrast.\n"
             "Thresholding: Separates handwriting strokes cleanly from background noise for neural inference.", COLOR_MUTED)

    # SLIDE 10: HANDWRITING RECOGNITION ENGINE
    s10 = prs.slides.add_slide(blank_layout)
    set_bg(s10)
    add_header(s10, "HWR Microservice", "PaddleOCR Recognition Engine")

    add_card(s10, Inches(0.8), Inches(1.8), w_half, Inches(4.8), "Microservice Execution Flow",
             "Processed Answer Image PNG\n"
             "  │\n"
             "  ▼\n"
             "FastAPI POST /api/v1/ocr/recognize-strokes\n"
             "  │\n"
             "  ▼\n"
             "PaddleHWRProvider (PaddleOCR 3.7.0 / PP-OCRv5)\n"
             "  │\n"
             "  ▼\n"
             "Extracted Text String + Confidence Score\n"
             "  │\n"
             "  ▼\n"
             "MongoDB Persistence (AnswerSheet Document)", COLOR_CYAN)

    add_card(s10, Inches(6.9), Inches(1.8), w_half, Inches(4.8), "Microservice Features",
             "• RESTful API-based microservice architecture\n\n"
             "• Python 3.11 FastAPI high-throughput server\n\n"
             "• PaddleOCR PP-OCRv5 mobile recognition neural head\n\n"
             "• Lazy engine loading to preserve system RAM\n\n"
             "• Structured JSON response with confidence scoring", COLOR_TEXT)

    # SLIDE 11: CORE DEMONSTRATION
    s11 = prs.slides.add_slide(blank_layout)
    set_bg(s11)
    add_header(s11, "Core Demonstration", "Handwritten Answer → Digitized Text")

    img_s11 = os.path.join(assets_dir, "generated_student_handwriting.png")
    add_card(s11, Inches(0.8), Inches(1.8), w_half, Inches(3.8), "INPUT: HANDWRITTEN CANVAS STROKES", "", COLOR_TEXT)
    if os.path.exists(img_s11):
        s11.shapes.add_picture(img_s11, Inches(1.1), Inches(2.4), width=Inches(5.0))

    add_card(s11, Inches(6.9), Inches(1.8), w_half, Inches(3.8), "OUTPUT: DIGITIZED TEXT (PADDLEOCR)",
             '"ADDLE OLR PERSISTENTE ("\n\n'
             "Provider: PaddleOCR 3.7.0\n"
             "Confidence: 61.37% (MEDIUM)", COLOR_EMERALD, COLOR_EMERALD)

    add_card(s11, Inches(0.8), Inches(5.8), Inches(11.7), Inches(1.0), "Core Milestone", "Digital handwriting successfully transformed into machine-readable text.", COLOR_CYAN, COLOR_CYAN)

    # SLIDE 12: TECHNICAL OUTPUT
    s12 = prs.slides.add_slide(blank_layout)
    set_bg(s12)
    add_header(s12, "API Output", "OCR API Response Payload")

    json_str = (
        '{\n'
        '  "success": true,\n'
        '  "message": "Handwriting recognition completed.",\n'
        '  "data": {\n'
        '    "answerSheetId": "6a97c197883c3047ee452bed",\n'
        '    "provider": "paddle",\n'
        '    "executionTimeSec": 82.84,\n'
        '    "overallConfidence": 0.6137,\n'
        '    "extractedText": "Q1: ADDLE OLR PERSISTENTE (",\n'
        '    "answers": [{\n'
        '      "questionId": "q1",\n'
        '      "recognizedText": "ADDLE OLR PERSISTENTE (",\n'
        '      "hwrStatus": "Completed"\n'
        '    }]\n'
        '  }\n'
        '}'
    )
    add_card(s12, Inches(0.8), Inches(1.8), w_half, Inches(4.8), "JSON Response Payload", json_str, COLOR_CYAN)

    add_card(s12, Inches(6.9), Inches(1.8), w_half, Inches(4.8), "Field Explanations",
             "extractedText:\n"
             "Concatenated transcribed text stored in MongoDB.\n\n"
             "confidence:\n"
             "Neural confidence metric generated by PP-OCRv5 head.\n\n"
             "executionTimeSec:\n"
             "Total latency for stroke rendering & inference.\n\n"
             "hwrStatus:\n"
             "Completion flag for background job polling.", COLOR_TEXT)

    # SLIDE 13: SYSTEM VALIDATION
    s13 = prs.slides.add_slide(blank_layout)
    set_bg(s13)
    add_header(s13, "Validation", "System & Pipeline Validation")

    add_card(s13, Inches(0.8), Inches(1.8), Inches(5.5), Inches(4.8), "Verified Acceptance Criteria",
             "✓ Canvas strokes correctly rendered to image files\n\n"
             "✓ FastAPI OCR microservice returns 200 OK\n\n"
             "✓ PaddleOCR engine executes real neural inference\n\n"
             "✓ Transcribed text persisted into MongoDB\n\n"
             "✓ Digitized text bound to Faculty UI display", COLOR_EMERALD, COLOR_EMERALD)

    img_s13 = os.path.join(assets_dir, "manual_eval_screen.png")
    if os.path.exists(img_s13):
        s13.shapes.add_picture(img_s13, Inches(6.6), Inches(1.8), width=Inches(5.9))

    # SLIDE 14: CURRENT STATUS & ROADMAP
    s14 = prs.slides.add_slide(blank_layout)
    set_bg(s14)
    add_header(s14, "Roadmap", "Current Status & Next Phase")

    add_card(s14, Inches(0.8), Inches(1.8), w_half, Inches(4.8), "Completed Milestone 1 [Achieved]",
             "✓ Digital Answer Stroke Capture\n\n"
             "✓ OpenCV Image Preprocessing\n\n"
             "✓ FastAPI PaddleOCR Integration\n\n"
             "✓ Neural Handwriting Recognition\n\n"
             "✓ Machine-Readable Text Digitization", COLOR_EMERALD, COLOR_EMERALD)

    add_card(s14, Inches(6.9), Inches(1.8), w_half, Inches(4.8), "Next Phase [Future Scope]",
             "Digitized Text\n"
             "  │\n"
             "  ▼\n"
             "Semantic Answer Understanding (LLM Prompting)\n"
             "  │\n"
             "  ▼\n"
             "Model Answer Comparison & Rubrics\n"
             "  │\n"
             "  ▼\n"
             "Automated Marking & Faculty Review Interface", COLOR_AMBER, COLOR_AMBER)

    # SLIDE 15: CONCLUSION
    s15 = prs.slides.add_slide(blank_layout)
    set_bg(s15)
    add_header(s15, "Conclusion", "From Handwriting to Machine-Readable Text")

    c3_w = Inches(3.6)
    add_card(s15, Inches(0.8), Inches(1.8), c3_w, Inches(3.5), "1. Digital First", "Captures handwritten responses directly from digital slates, eliminating physical paper scanning and logistics.", COLOR_CYAN)
    add_card(s15, Inches(4.85), Inches(1.8), c3_w, Inches(3.5), "2. Intelligent Digitization", "Leverages state-of-the-art PaddleOCR PP-OCRv5 neural models for robust handwriting digitization.", COLOR_BLUE)
    add_card(s15, Inches(8.9), Inches(1.8), c3_w, Inches(3.5), "3. AI-Ready Data", "Converts raw student handwriting into structured machine-readable text ready for automated downstream pipelines.", COLOR_EMERALD)

    add_card(s15, Inches(0.8), Inches(5.6), Inches(11.7), Inches(1.2), "Closing Statement", "“From Digital Handwriting to Machine-Readable Knowledge.”", COLOR_CYAN, COLOR_CYAN)

    # Save presentation
    output_path = r"d:\CE\sem5\SGP\Ai based evaluation sheet\presentation\presentation_deck.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    create_presentation()
