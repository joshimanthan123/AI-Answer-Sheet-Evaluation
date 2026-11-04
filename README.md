# AI-Based Automated Answer Sheet Evaluation System

An AI-powered digital answer-sheet evaluation platform featuring handwritten OCR digitization, semantic rubric-based grading, reference answer intelligence, faculty review & override workflows, analytics reporting, production security hardening, and containerized deployment infrastructure.

---

## Architecture Overview

```text
USERS / CLIENTS
      │
    HTTPS
      ▼
┌─────────────────────────┐
│  React + Vite Frontend  │  (Port 80 / 5173 - Nginx)
└────────────┬────────────┘
             │ REST API
             ▼
┌─────────────────────────┐
│ Node.js Express Backend │  (Port 5000)
└─────┬─────────────┬─────┘
      │             │
      ▼             ▼
┌───────────┐   ┌───────────────────────────┐
│  MongoDB  │   │ FastAPI OCR Microservice  │  (Port 8000 - Amazon Textract / PaddleOCR)
└───────────┘   └─────────────┬─────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ OpenAI (gpt-4o) │
                     └─────────────────┘
```

---

## Production Deployment (Docker Compose)

### 1. Prerequisites
- **Docker Engine**: `>= 24.0.0`
- **Docker Compose**: `>= 2.20.0`

### 2. Environment Configuration
Copy `.env.example` templates across directories:

```bash
cp server/.env.example server/.env
cp ocr-service/.env.example ocr-service/.env
cp client/.env.example client/.env
```

### 3. Launch Containerized Ecosystem
```bash
# Build and start all services in background
docker-compose up -d --build

# Verify container health
docker-compose ps
```

Access services:
- **Frontend App**: `http://localhost:5173` (or `http://localhost:80`)
- **Backend API**: `http://localhost:5000/api/v1`
- **OCR Microservice**: `http://localhost:8000/docs`

---

## Development Setup

```bash
# Backend Server
cd server
npm install
npm run dev

# Frontend Client
cd client
npm install
npm run dev

# Python OCR Service
cd ocr-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### OCR Provider Configuration

The OCR microservice defaults to **Amazon Textract** (`HWR_PROVIDER=textract`). Alternative providers remain selectable via configuration:
- `HWR_PROVIDER=textract` (Default: cloud OCR via AWS Textract)
- `HWR_PROVIDER=paddleocr` (Local offline engine via PaddleOCR)
- `HWR_PROVIDER=mock` (Deterministic test provider for local/CI environments)

For Textract, configure AWS credentials via standard environment variables:
```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID="<your-access-key>"
export AWS_SECRET_ACCESS_KEY="<your-secret-key>"
# If using AWS Academy Learner Lab temporary credentials:
export AWS_SESSION_TOKEN="<your-session-token>"
```

---

## System Documentation

- 📊 [Final Test Report — System Verification](./FINAL_TEST_REPORT.md)
- 📋 [Project Completion Report & 24-Stage Matrix](./PROJECT_COMPLETION_REPORT.md)
- 📐 [Architecture Specification](./ARCHITECTURE.md)
- 📄 [Production Deployment Guide](./DEPLOYMENT.md)
- 🛠️ [Production Operations Runbook](./PRODUCTION_RUNBOOK.md)
- 🔒 [Security Audit Report](./SECURITY_AUDIT.md)
- 🚀 [Production Readiness Guide](./PRODUCTION_READINESS.md)
- ⚙️ [CI/CD Verification Workflow](./.github/workflows/ci.yml)

---

## License

Academic / Educational Project Use.
