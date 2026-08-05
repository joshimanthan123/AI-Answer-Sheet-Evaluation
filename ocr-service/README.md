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
