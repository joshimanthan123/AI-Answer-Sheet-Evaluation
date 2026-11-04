# PRODUCTION OPERATIONS RUNBOOK

**System Name:** AI-Based Automated Answer Sheet Evaluation System  
**Target Environment:** Staging & Production Operations  
**Document Status:** OPERATIONAL  

---

## 1. QUICK REFERENCE OPERATIONAL COMMANDS

| Action | Command |
|---|---|
| **Start All Containers** | `docker-compose up -d` |
| **Stop All Containers** | `docker-compose down` |
| **Rebuild Containers** | `docker-compose up -d --build` |
| **Inspect Live Logs** | `docker-compose logs -f --tail=100` |
| **Check Container Health** | `docker-compose ps` |
| **Restart Backend** | `docker-compose restart backend` |
| **Restart OCR Service** | `docker-compose restart ocr-service` |

---

## 2. SERVICE COMPONENT CHECKS

### A. Express Backend Check
Run health endpoint diagnostic:
```bash
curl -i http://localhost:5000/health
```
**Expected Response:** HTTP 200 OK with `database: "Connected"`.

### B. FastAPI OCR Microservice Check
Run health endpoint diagnostic:
```bash
curl -i http://localhost:8000/health
```
**Expected Response:** HTTP 200 OK with `provider: "paddle"`.

### C. MongoDB Connection Check
Verify connection state using `mongosh`:
```bash
mongosh "mongodb://localhost:27017/ai_evaluation_db" --eval "db.stats()"
```

---

## 3. LOG INSPECTION PROCEDURES

- **Backend Application Logs**:
```bash
docker-compose logs -f backend
# Or inspect local file:
tail -f server/logs/app.log
```

- **OCR Service Application Logs**:
```bash
docker-compose logs -f ocr-service
# Or inspect local file:
tail -f ocr-service/logs/ocr_service.log
```

- **Database Logs**:
```bash
docker-compose logs -f mongodb
```

---

## 4. VERIFYING CORE SYSTEM WORKFLOWS

### Test 1: User Authentication
Execute API test call to login endpoint:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"faculty@university.edu","password":"Password123!"}'
```
**Expected Outcome:** HTTP 200 OK returning `accessToken` and user role `faculty`.

### Test 2: OCR Service Recognition
Verify PaddleOCR handwriting recognition:
```bash
curl -X POST http://localhost:8000/api/v1/ocr/recognize \
  -F "file=@ocr-service/test_handwriting.png"
```
**Expected Outcome:** HTTP 200 OK returning transcribed text lines and confidence metrics.

### Test 3: Live End-to-End System Test
Run backend integration test suite:
```bash
cd server
node src/tests/test-complete-system-integration.js
```
**Expected Outcome:** `🎉 COMPLETE SYSTEM INTEGRATION TEST PASSED`.

---

## 5. INCIDENT RESPONSE & TROUBLESHOOTING

### Incident A: OCR Service Unresponsive
**Symptom:** AI evaluation pipeline flags answer sheets with `OCR_NOT_COMPLETED` or `service_unavailable`.  
**Remediation:**
1. Check OCR service container logs: `docker-compose logs --tail=100 ocr-service`.
2. Verify Python memory usage: `docker stats ai_eval_ocr_service`.
3. Restart OCR service: `docker-compose restart ocr-service`.

### Incident B: OpenAI API Rate Limit / Timeout
**Symptom:** Evaluation pipeline output displays status `failed` with error `AI_RESPONSE_VALIDATION_FAILED` or `ETIMEDOUT`.  
**Remediation:**
1. Check backend logs for rate limit errors: `docker-compose logs backend | grep -i openai`.
2. Confirm `OPENAI_API_KEY` is active and quota is available.
3. System automatically sets evaluation state to `failed` and flags for manual faculty review without destroying previous state.

### Incident C: Database Disconnection
**Symptom:** Backend returns HTTP 500 or health check reports `database: "Disconnected"`.  
**Remediation:**
1. Check MongoDB container status: `docker-compose ps mongodb`.
2. Verify host disk space: `df -h`.
3. Restart MongoDB and Backend containers: `docker-compose restart mongodb backend`.

---

## 6. MAINTENANCE PROCEDURES

### Clearing Temporary Files
```bash
# Clean temporary uploads older than 7 days
find server/uploads -type f -mtime +7 -delete
find ocr-service/outputs -type f -mtime +7 -delete
```

### Rotating Logs
Winston and Uvicorn log rotating handlers automatically limit file size to 10MB retaining up to 5 backup logs.
