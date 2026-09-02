import time
import requests
import io
import fitz

def main():
    print("Generating demo multi-page PDF...")
    doc = fitz.open()
    # Page 1
    p1 = doc.new_page(width=300, height=400)
    p1.insert_text((20, 50), "Q1: Explain what is FastAPI.", fontsize=12)
    p1.insert_text((20, 80), "FastAPI is a modern, fast, high-performance web framework", fontsize=10)
    # Page 2
    p2 = doc.new_page(width=300, height=400)
    p2.insert_text((20, 50), "Q2) Describe the database model.", fontsize=12)
    p2.insert_text((20, 80), "We use MongoDB for database storage with a clean repository pattern.", fontsize=10)
    
    pdf_bytes = doc.write()
    
    url_base = "http://127.0.0.1:8000/api/v1"
    headers = {
        "X-User-Id": "verify-student-1",
        "X-User-Role": "student"
    }

    # Step 1: Upload and enqueue
    print("Uploading answer sheet...")
    files = {
        "file": ("sheet_demo.pdf", pdf_bytes, "application/pdf")
    }
    import uuid
    dynamic_sheet_id = f"demo-sheet-{uuid.uuid4()}"
    data = {
        "exam_id": "maths-101",
        "sheet_id": dynamic_sheet_id
    }
    
    resp = requests.post(f"{url_base}/student/answer-sheets", files=files, data=data, headers=headers)
    print("Upload Status:", resp.status_code)
    sheet_data = resp.json().get("data", {})
    sheet_id = sheet_data.get("id")
    print("Queued Sheet ID:", sheet_id)

    # Step 2: Poll status
    print("Polling processing status...")
    for _ in range(30):
        status_resp = requests.get(f"{url_base}/student/answer-sheets/{sheet_id}/processing-status", headers=headers)
        status_data = status_resp.json().get("data", {})
        print(f"Status: {status_data.get('processing_status')}, Progress: {status_data.get('processing_progress')}%, Current Step: {status_data.get('current_step')}")
        if status_data.get("processing_status") in ("COMPLETED", "FAILED"):
            if status_data.get("processing_status") == "FAILED":
                print("Error Message:", status_data.get("error_message"))
                print("Error Details:", status_data.get("error_details"))
            break
        time.sleep(1)

    # Step 3: Fetch details
    print("Fetching page-level details...")
    pages_resp = requests.get(f"{url_base}/student/answer-sheets/{sheet_id}/pages", headers=headers)
    print("Pages Metadata:", pages_resp.json().get("data"))

    print("Fetching digital answers...")
    answers_resp = requests.get(f"{url_base}/student/answer-sheets/{sheet_id}/answers", headers=headers)
    print("Digital Answers:", answers_resp.json().get("data"))

    # Step 4: Re-process single page
    print("Reprocessing Page 2...")
    repage_resp = requests.post(f"{url_base}/student/answer-sheets/{sheet_id}/pages/2/reprocess", headers=headers)
    print("Page Reprocess Trigger:", repage_resp.json())
    
    # Poll status again
    print("Polling status after page reprocessing...")
    for _ in range(15):
        status_resp = requests.get(f"{url_base}/student/answer-sheets/{sheet_id}/processing-status", headers=headers)
        status_data = status_resp.json().get("data", {})
        print(f"Status: {status_data.get('processing_status')}, Progress: {status_data.get('processing_progress')}%, Current Step: {status_data.get('current_step')}")
        if status_data.get("processing_status") in ("COMPLETED", "FAILED"):
            break
        time.sleep(1)

    print("Pipeline integration verification successfully run.")

if __name__ == "__main__":
    main()
