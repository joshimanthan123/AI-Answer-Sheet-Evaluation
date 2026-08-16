# OCR Handwriting Recognition Microservice

This repository hosts the standalone **OCR Handwriting Recognition Microservice**, built using **FastAPI** as part of the **AI-Based Automated Answer Sheet Evaluation System**. 

The microservice runs independently and allows integration with the Node.js backend via clean, RESTful API endpoints.

---

## Technical Stack

* **Python 3.11+**
* **FastAPI** (Web Framework)
* **Uvicorn** (ASGI Web Server)
* **Pydantic** (Data Modeling & Configurations)
* **Standard Python Logging**

---

## Directory Structure

```text
ocr-service/
│
├── app/
│   ├── __init__.py         # Package indicator
│   ├── main.py             # FastAPI App instance and logging setup
│   ├── config.py           # Configuration management & directory provision
│   ├── routes/
│   │   ├── __init__.py     # Routes package indicator
│   │   └── health.py       # Health check API route
│   ├── services/           # Placeholder for OCR recognition logic (future phases)
│   ├── utils/              # Placeholder for helper utilities
│   └── models/             # Placeholder for data schemas
│
├── uploads/                # Local cache directory for temporary image uploads (gitignored)
├── outputs/                # Local cache directory for OCR evaluation summaries (gitignored)
├── logs/                   # Local logs repository for rotating files (gitignored)
├── tests/                  # Directory for automated pytest checks (future phases)
│
├── requirements.txt        # Managed dependency checklist
├── .gitignore              # Configured Git tracking rules
├── README.md               # Setup and development handbook
└── run.py                  # Module launcher script
```

---

## Installation & Setup

Ensure you have **Python 3.11+** installed on your operating system.

### 1. Initialize Python Virtual Environment
Navigate to the `ocr-service/` directory and execute:

```bash
# Windows
python -m venv venv

# Activate Virtual Environment
# PowerShell
.\venv\Scripts\Activate.ps1
# CMD
.\venv\Scripts\activate.bat
# Linux/macOS
source venv/bin/activate
```

### 2. Install Project Dependencies
Run `pip` to sync packages:

```bash
pip install -r requirements.txt
```

---

## Running the Application

Execute the standard launch wrapper to initialize the Uvicorn web server:

```bash
python run.py
```

By default, the server runs on `http://127.0.0.1:8000`.

---

## Core API Endpoints

### 1. Health Status
Verify that the service is running correctly:

* **Endpoint**: `GET http://127.0.0.1:8000/health`
* **Sample Response**:
  ```json
  {
    "success": true,
    "service": "OCR Service",
    "status": "Running"
  }
  ```

---

## Interactive API Documentation

FastAPI automatically compiles schema definitions into visual API testing dashboards:

* **Swagger UI (Interactive Docs)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc (Detailed Spec)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## Handwriting Recognition (HWR) Providers

The service recognizes handwriting through a pluggable provider architecture
(`app/providers/`), selected at runtime by the `HWR_PROVIDER` environment
variable:

| `HWR_PROVIDER` | Provider | Use |
| --- | --- | --- |
| `google_vision` (default) | `GoogleVisionHWRProvider` | Real OCR via **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`). Extracts printed and handwritten text with line/word confidence. |
| `azure` | `AzureProvider` | Real OCR via **Azure AI Document Intelligence** (`prebuilt-read`). Extracts printed and handwritten text with line/word confidence. |
| `paddle` | `PaddleHWRProvider` | Offline local OCR via **PaddleOCR**. |
| `mock` | `MockProvider` | Offline, deterministic text for local dev and tests. No network, no credentials. |

There is **no silent fallback**: if `HWR_PROVIDER=google_vision` (or `azure`) but the configurations/credentials
are missing, the service fails fast at startup with a clear configuration error
rather than quietly returning mock text.

### Google Cloud Vision Setup

Google Cloud Vision is the default HWR provider, leveraging Google's dense `DOCUMENT_TEXT_DETECTION` (Document Text OCR) optimized for structured documents and handwriting processing.

**1. Create a Google Cloud Project & Enable API**
- Log in to the [Google Cloud Console](https://console.cloud.google.com).
- Create a new project or select an existing one.
- Go to the **API Library** and search for and enable the **Cloud Vision API**.

**2. Generate a Service Account Key File**
- Navigate to **IAM & Admin** > **Service Accounts**.
- Click **Create Service Account**, set its name, and grant the **Cloud Vision API User** role (or similar authorization).
- Click on the created Service Account, navigate to the **Keys** tab, click **Add Key** > **Create new key**, and select **JSON** format.
- Download the generated JSON key. Treat this file as sensitive: **never commit it to Git and never print its contents.**

**3. Configure Environment Variables**
Copy `.env.example` to `.env` and fill in the values:

```bash
HWR_PROVIDER=google_vision
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\credentials\google-vision-service-account.json
# Optional language hints (e.g. "en-t-i0-handwrit" for English handwriting, leave blank by default)
GOOGLE_VISION_LANGUAGE_HINT=
GOOGLE_VISION_TIMEOUT_SECONDS=30
```

Windows example:
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\credentials\google-vision-service-account.json
```

**4. Install dependency**
The `google-cloud-vision` client library is declared in `requirements.txt`. Build the active virtual environment dependencies:
```bash
.venv\Scripts\python.exe -m pip install google-cloud-vision
```

---

### Azure AI Document Intelligence setup

The steps below follow Microsoft's official documentation for the
`azure-ai-documentintelligence` SDK and the `prebuilt-read` model.

**1. Create the Azure resource**

- In the [Azure portal](https://portal.azure.com), create a resource of type
  **Document Intelligence** (formerly *Form Recognizer*). The free **F0** tier
  is sufficient for testing.
- Pick a region and give the resource a name, then create it.

**2. Get the endpoint**

- Open the resource, go to **Keys and Endpoint**.
- Copy the **Endpoint** (e.g. `https://<your-resource>.cognitiveservices.azure.com/`).

**3. Get the API key**

- On the same **Keys and Endpoint** page, copy **KEY 1** (or KEY 2).
- Treat this key as a secret — never commit it or print it.

**4. Environment variables**

Copy `.env.example` to `.env` and fill in the values (set `HWR_PROVIDER=mock`
if you only want offline mock recognition):

```bash
HWR_PROVIDER=azure
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<your-key>
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read
# Per-page analysis timeout (seconds)
AZURE_TIMEOUT=30.0
```

`.env` is gitignored; only `.env.example` (with blank placeholders) is committed.

**5. Install the dependency**

The Azure package is listed in `requirements.txt`. Install it into the
project's **Python 3.11** virtual environment (do **not** use a system Python):

```bash
# Windows (from ocr-service/)
.venv\Scripts\python.exe -m pip install azure-ai-documentintelligence
```

Verify the install:

```bash
.venv\Scripts\python.exe -c "import azure.ai.documentintelligence; print('Azure Document Intelligence OK')"
```

**6. Switch from mock to Azure**

Set `HWR_PROVIDER=azure` in `.env`, then (re)start the service. Use
`--reload-dir app` so the auto-reloader watches only source code and does not
wipe the in-memory answer-sheet repository on every storage write:

```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000
```

**7. Test with a handwritten image**

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/ocr/recognize" \
  -F "file=@/path/to/handwritten.png"
```

A successful response has `"provider": "azure"` and `data.text` containing the
text actually recognized from the image, for example:

```json
{
  "success": true,
  "message": "Handwriting recognition completed successfully.",
  "data": {
    "text": "Artificial Intelligence is the simulation ...",
    "confidence": 0.91,
    "lines": [{ "text": "Artificial Intelligence is the simulation ...", "confidence": 0.91 }],
    "provider": "azure",
    "execution_time": 1.42
  }
}
```

Full answer-sheet processing (PDF/image upload, per-page OCR, segmentation,
digital answers) runs through `POST /api/v1/student/answer-sheets` and uses the
same provider — one Azure analysis per processed page.

### Recognition quality

Azure OCR accuracy depends on handwriting legibility, image resolution,
language, page orientation, and preprocessing. Results are **not** guaranteed to
be perfect; the service reports the actual per-line and overall confidence
returned by Azure and never fabricates a fixed confidence value.

### Troubleshooting authentication / configuration errors

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Startup error: *"endpoint/key is not configured"* | `HWR_PROVIDER=azure` but env vars unset | Set `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `_KEY` in `.env`. |
| *"Azure authentication failed (401)"* | Wrong key or endpoint | Re-copy KEY 1 and the Endpoint from the portal; ensure they belong to the same resource. |
| *"Azure resource or model not found (404)"* | Endpoint typo or wrong model id | Verify the endpoint host and that `AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read`. |
| *"Azure request was rate limited (429)"* | Free-tier throughput exceeded | Retry after a short delay or upgrade the tier. |
| *"package is not installed"* | SDK missing from the active venv | Run the install command above using the project's `.venv` Python. |

The API key is never written to logs or included in error messages.

---

## Testing

Run the full backend test suite (all providers are mocked — no real Azure calls
are made) from the `ocr-service/` directory:

```bash
.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

- `tests/test_hwr.py` — Mock provider, service selector/validation, Azure and Google Vision result mapping and factory loading.
- `tests/test_google_vision_provider.py` — Google Vision config validation, numpy→PNG encoding, layout annotation→`HWRResult` mapping, confidence mapping, credentials file check, and API exception handling (auth/rate-limit/network), with mocked `ImageAnnotatorClient`.
- `tests/test_azure_provider.py` — Azure config validation, numpy→PNG encoding, result→`HWRResult` mapping, confidence fallback, `page_num`, and error handling (auth/rate-limit/network), all with a mocked `DocumentIntelligenceClient`.
- `tests/integration/test_google_vision_integration.py` — optional live integration test with a sample image, skipped gracefully if no credentials configured.
- `tests/azure_fakes.py` — helpers that build fake Azure result objects.

