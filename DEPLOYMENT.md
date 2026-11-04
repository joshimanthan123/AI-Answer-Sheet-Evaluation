# PRODUCTION DEPLOYMENT GUIDE

**Project:** AI-Based Automated Answer Sheet Evaluation System  
**Phase:** Phase 8B — Deployment & Infrastructure  
**Target Environment:** Staging & Production Deployment  
**Document Status:** VERIFIED  

---

## 1. SYSTEM ARCHITECTURE & DEPLOYMENT STRATEGY

The application is containerized and deployable via **Docker Compose** or as individual microservices across cloud hosting providers (e.g. Render, Railway, AWS ECS, DigitalOcean App Platform, Vercel).

```text
                           CLIENTS / USERS
                                 │
                            HTTPS / 443
                                 ▼
                    ┌─────────────────────────┐
                    │  React + Vite Frontend  │  (Port 80 / Nginx)
                    └────────────┬────────────┘
                                 │ HTTP API / 5000
                                 ▼
                    ┌─────────────────────────┐
                    │ Node.js Express Backend │  (Port 5000)
                    └─────┬─────────────┬─────┘
                          │             │
              ┌───────────┘             └────────────┐
              ▼                                      ▼
   ┌────────────────────┐                  ┌──────────────────┐
   │ MongoDB Production │                  │ FastAPI OCR      │  (Port 8000)
   │ (Port 27017)       │                  │ (PaddleOCR)      │
   └────────────────────┘                  └─────────┬────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │ OpenAI gpt-4o API│
                                            └──────────────────┘
```

### Deployed Services Summary:
- **Frontend App**: Nginx serving built static assets from `client/dist`, proxying `/api` to Express backend.
- **Backend**: Node.js 18+ Express server handling authentication, exam submission, evaluation coordination, faculty reviews, and analytics export.
- **OCR Microservice**: Python 3.11 FastAPI service hosting PaddleOCR engine for handwriting recognition.
- **Database**: MongoDB 7.0 with persistent volume storage and compound indexes.
- **AI Model**: OpenAI API (`gpt-4o`) for semantic evaluation and rubric scoring.

---

## 2. PREREQUISITES

- **Docker Engine**: `>= 24.0.0`
- **Docker Compose**: `>= 2.20.0`
- **Node.js** (for local development/builds): `>= 18.0.0`
- **Python** (for local development/builds): `>= 3.11.0`
- **MongoDB**: `>= 6.0` (or Mongo Atlas production cluster URI)

---

## 3. PRODUCTION ENVIRONMENT VARIABLES

Before launching, configure environment variable files from the provided `.env.example` templates:

### Root / Docker Compose (`.env`)
```env
JWT_ACCESS_SECRET=prod_super_secret_access_key_replace_in_production_32chars
JWT_REFRESH_SECRET=prod_super_secret_refresh_key_replace_in_production_32chars
OPENAI_API_KEY=your_live_openai_api_key_here
```

### Express Backend (`server/.env`)
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/ai_evaluation_db
CORS_ORIGIN=http://localhost:5173,http://localhost:80
OCR_SERVICE_URL=http://ocr-service:8000

JWT_ACCESS_SECRET=prod_super_secret_access_key_replace_in_production_32chars
JWT_REFRESH_SECRET=prod_super_secret_refresh_key_replace_in_production_32chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

OPENAI_API_KEY=your_live_openai_api_key_here
LLM_MODEL_NAME=gpt-4o
AI_TIMEOUT=30000
SIMILARITY_THRESHOLD=0.7
MAX_RETRIES=3

HWR_PROVIDER=paddle
MAX_FILE_SIZE=10485760
ALLOWED_FILE_EXTENSIONS=pdf,png,jpg,jpeg
```

### OCR Service (`ocr-service/.env`)
```env
HOST=0.0.0.0
PORT=8000
DEBUG=False
HWR_PROVIDER=paddle
OCR_MAX_UPLOAD_SIZE_MB=20
```

### React Client (`client/.env`)
```env
VITE_API_BASE_URL=/api/v1
```

---

## 4. DEPLOYMENT STEPS (DOCKER COMPOSE)

### Step 1: Clone & Configure Environment
```bash
git clone <repository-url>
cd "Ai based evaluation sheet"

# Create production environment files
cp server/.env.example server/.env
cp ocr-service/.env.example ocr-service/.env
cp client/.env.example client/.env
```

### Step 2: Build & Start Containerized Services
```bash
docker-compose up -d --build
```

### Step 3: Verify Container Health & Logs
```bash
# Inspect container status
docker-compose ps

# Check logs across services
docker-compose logs -f --tail=50
```

---

## 5. INDIVIDUAL CLOUD PROVIDER DEPLOYMENT GUIDELINES

### A. Deploying Frontend to Vercel / Netlify / Render Static Site
1. Connect repository `client/` subdirectory.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set Environment Variable: `VITE_API_BASE_URL=https://<your-backend-domain>/api/v1`

### B. Deploying Backend to Render / Railway / AWS App Runner
1. Root directory: `server/`
2. Build command: `npm install`
3. Start command: `node server.js`
4. Configure environment variables (`MONGODB_URI`, `JWT_ACCESS_SECRET`, `OPENAI_API_KEY`, `OCR_SERVICE_URL`, `CORS_ORIGIN`).

### C. Deploying OCR Microservice to Railway / Render Web Service / AWS ECS
1. Root directory: `ocr-service/`
2. Environment: Python 3.11
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`

### D. MongoDB Production Setup (MongoDB Atlas)
1. Provision MongoDB Atlas M10+ cluster.
2. Configure IP Access List allowing backend server IP addresses.
3. Set `MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/ai_evaluation_db?retryWrites=true&w=majority` in backend `.env`.

---

## 6. HEALTH CHECK VERIFICATION

### Backend Health Check:
`GET http://localhost:5000/health`
Expected HTTP Status: `200 OK`
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

### OCR Service Health Check:
`GET http://localhost:8000/health`
Expected HTTP Status: `200 OK`
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

## 7. SSL / HTTPS & CORS SETUP

- In production, terminate SSL using Nginx / Cloudflare / Let's Encrypt at the ingress level.
- Ensure `CORS_ORIGIN` in backend matches exact production HTTPS domain (`https://yourdomain.com`).
- Enforce `secure` cookies and strict `SameSite` policies in production mode.

---

## 8. BACKUP & RECOVERY PROCEDURES

### MongoDB Automated Backup Command:
```bash
mongodump --uri="mongodb://localhost:27017/ai_evaluation_db" --out=/backup/$(date +%F)
```

### Database Restore Command:
```bash
mongorestore --uri="mongodb://localhost:27017/ai_evaluation_db" /backup/2026-09-27/ai_evaluation_db
```

---

## 9. TROUBLESHOOTING & EMERGENCY ROLLBACK

- **Service Unresponsive**: Run `docker-compose restart <service_name>`.
- **PaddleOCR Cold Start**: On first startup, PaddleOCR downloads its models to disk (`~/.paddleocr/`). Allow up to 30s initial boot time.
- **Rollback deployment**:
```bash
git checkout <previous-stable-tag>
docker-compose up -d --build
```
