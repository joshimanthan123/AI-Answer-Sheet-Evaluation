# PRODUCTION READINESS GUIDE

**Project:** AI-Based Automated Answer Sheet Evaluation System  
**Phase:** Phase 8A — Production Optimization & Security  
**Version:** 1.0.0 (Production Hardened)  

---

## 1. ARCHITECTURE OVERVIEW

The platform uses a decoupled, three-tier architecture:

```text
[ React + Vite Frontend ]
        │  (HTTP / REST / PORT 5173)
        ▼
[ Node.js + Express Backend ] ────► [ MongoDB Database ]
        │  (Reverse Proxy / HTTP / PORT 5000)
        ▼
[ Python FastAPI OCR Service ] ────► [ PaddleOCR / HWR Engine ]
        │
        ▼
[ LLM Provider (OpenAI gpt-4o) ]
```

### Local Services & Ports:
- **Frontend App**: `http://localhost:5173`
- **Node.js Express Backend**: `http://127.0.0.1:5000`
- **FastAPI OCR Service**: `http://127.0.0.1:8000`
- **MongoDB Instance**: `mongodb://localhost:27017/ai_evaluation_db`

---

## 2. ENVIRONMENT CONFIGURATION

### Backend (.env)
Copy `server/.env.example` to `server/.env` and update values:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/ai_evaluation_db
CORS_ORIGIN=http://localhost:5173

JWT_ACCESS_SECRET=your_production_secure_jwt_access_secret_32_chars
JWT_REFRESH_SECRET=your_production_secure_jwt_refresh_secret_32_chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

OPENAI_API_KEY=your_live_openai_api_key
LLM_MODEL_NAME=gpt-4o
AI_TIMEOUT=30000
SIMILARITY_THRESHOLD=0.7
MAX_RETRIES=3

HWR_PROVIDER=paddle
MAX_FILE_SIZE=10485760
ALLOWED_FILE_EXTENSIONS=pdf,png,jpg,jpeg
```

### OCR Service (.env)
Copy `ocr-service/.env.example` to `ocr-service/.env` and update values:

```env
HOST=127.0.0.1
PORT=8000
DEBUG=False
HWR_PROVIDER=paddle
OCR_MAX_UPLOAD_SIZE_MB=20
```

### Frontend (.env)
Copy `client/.env.example` to `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 3. SECURITY CONFIGURATION

### Authentication & Authorization
- **Passwords**: Hashed with bcrypt (10 rounds).
- **JWT**: Bearer tokens verified on protected API routes. Passwords omitted from serializations.
- **Role Control**: Student (`student`), Faculty (`faculty`), Admin (`admin`) access controls enforced server-side.
- **Student Data Isolation**: Students can only access their own answer sheets, submission statuses, and published results.

### Security Headers & Rate Limiting
- **Helmet Headers**: Frameguard (`deny`), noSniff (`nosniff`), XSS filter enabled.
- **Rate Limits**:
  - Global API: 200 requests per 15 minutes per IP.
  - Login/Register Auth: 100 requests per 15 minutes per IP.
  - File Uploads & Evaluation: Controlled via explicit request validation and atomic database locks.
- **CORS**: Configured with explicit origin whitelisting (`CORS_ORIGIN`).

---

## 4. DATABASE OPTIMIZATION

- **Indexes**: Compound indexes configured on `AnswerSheet` and `Evaluation` models for fast lookup by `student`, `exam`, `submissionStatus`, and `evaluationStatus`.
- **ObjectId Validation**: Checked prior to database queries to prevent malformed query exceptions.

---

## 5. OCR & AI EVALUATION RELIABILITY

- **PaddleOCR Engine**: Native handwriting recognition pipeline operating locally via Python microservice.
- **Failure Safety**: If OCR or LLM operations fail, evaluation status updates to `failed` or `pending_review` with low confidence. No mock or hardcoded marks are assigned.
- **Concurrency Locks**: Multi-click duplicate evaluation requests are blocked atomically using database state locks (`QUEUED_FOR_EVALUATION`, `AI_EVALUATING`).

---

## 6. HEALTH CHECK ENDPOINTS

### Backend Health Check:
`GET http://localhost:5000/health`
Response:
```json
{
  "success": true,
  "message": "System is healthy",
  "data": {
    "status": "OK",
    "database": "Connected",
    "uptime": 120
  }
}
```

### OCR Microservice Health Check:
`GET http://localhost:8000/health`
Response:
```json
{
  "success": true,
  "message": "Service health diagnostics compiled.",
  "data": {
    "provider": "paddle",
    "uptime": 120.5
  }
}
```

---

## 7. DEPLOYMENT PREREQUISITES & COMMANDS

### Prerequisites:
- Node.js >= 18.x
- Python >= 3.11.x with PyTorch / PaddlePaddle installed
- MongoDB >= 6.x

### Build & Run Commands:

1. **Frontend Build**:
```bash
cd client
npm run build
```

2. **Backend Start**:
```bash
cd server
npm start
```

3. **OCR Service Start**:
```bash
cd ocr-service
python run.py
```

---

## 8. TROUBLESHOOTING & KNOWN LIMITATIONS

1. **OpenAI API Key Missing**: If `OPENAI_API_KEY` is not configured in `server/.env`, the AI evaluation pipeline will report `failed` status and flag for faculty review. Configure a valid key for live LLM grading.
2. **PaddleOCR Model Download**: On first run, PaddleOCR downloads its language model files to `~/.paddleocr/`. Ensure internet connection on initial startup.
3. **Large Image Memory Overhead**: Images exceeding 8000x8000 pixels are rejected by the OCR microservice to prevent memory exhaustion.
