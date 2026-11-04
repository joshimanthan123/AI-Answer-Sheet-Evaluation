# SECURITY AUDIT REPORT

**Project:** AI-Based Automated Answer Sheet Evaluation System  
**Phase:** Phase 8A — Production Optimization & Security  
**Audit Date:** September 2026  
**Status:** COMPLETED & VERIFIED  

---

## 1. EXECUTIVE SUMMARY

A comprehensive security audit of the AI-Based Automated Answer Sheet Evaluation System was conducted across all three core tiers:
1. **Frontend**: React + Vite (Port 5173)
2. **Backend**: Node.js + Express (Port 5000)
3. **OCR Service**: Python 3.11 + FastAPI + PaddleOCR (Port 8000)

The audit focused on identifying and mitigating security risks, authorization bypasses (IDOR), exposed credentials, input validation vulnerabilities, database bottlenecks, unhandled exceptions, and AI reliability risks.

All identified issues have been remediated and empirically verified without breaking any existing functionality from Phases 1 through 7.

---

## 2. SECURITY AUDIT FINDINGS & FIXES MATRIX

| ID | Category | Location | Risk Level | Existing Behavior | Fix Implemented | Verification |
|---|---|---|---|---|---|---|
| **SEC-01** | Exposed Secrets | `server/.env`, `ocr-service/.env` | HIGH | Local dev defaults present in `.env` files. | Verified `.env` is fully excluded via `.gitignore`. Updated `.env.example` templates across server, client, and ocr-service with clean placeholders. | Inspected `.gitignore` and verified tracked git state. |
| **SEC-02** | JWT Key Safety | `server/app.js` | HIGH | Static file upload middleware used fallback string `"default-secret-key-for-dev"`. | Replaced fallback string with strict `env.JWT.ACCESS_SECRET` token verification in static upload middleware. | Tested `/uploads` access with valid and invalid JWT tokens. |
| **SEC-03** | Authorization / IDOR | `server/src/routes/evaluation.routes.js` | CRITICAL | `GET /api/v1/evaluations` and `GET /api/v1/evaluations/:id` lacked explicit role-based authorization middleware. | Applied `authorize(ROLES.FACULTY, ROLES.ADMIN)` to `GET /` and `authorize(ROLES.FACULTY, ROLES.ADMIN, ROLES.STUDENT)` to `GET /:id`. Added student ownership & result publication checks in `evaluationService`. | Tested student access to unauthorized and unpublished evaluation endpoints; verified 403 Forbidden response. |
| **SEC-04** | Student Data Isolation | `server/src/services/evaluation.service.js` | HIGH | `getEvaluationById` and `getEvaluationDetail` did not check if evaluation results were published before allowing student access. | Added explicit `isPublished` verification for `ROLES.STUDENT` requests in `getEvaluationById` and `getEvaluationDetail`. | Verified student receives `403 Forbidden` ("Evaluation results have not been published by faculty yet.") when attempting to view unpublished results. |
| **SEC-05** | CORS Policy | `server/src/config/cors.js` | MEDIUM | Fixed single string check for CORS origins. | Configured dynamic CORS origin parsing to handle comma-separated whitelist arrays, trimmed trailing slashes, and enforced strict origin checking in production. | Verified CORS header response against allowed and forbidden origins. |
| **SEC-06** | Security Headers | `server/app.js` | MEDIUM | Standard helmet headers active but missing strict configuration. | Configured Helmet middleware with XSS filter, frameguard (deny clickjacking), MIME noSniff, and environment-driven Content Security Policy. | Inspected HTTP response headers for Security headers. |
| **SEC-07** | Input Validation | `server/src/validators/evaluation.validator.js` | MEDIUM | `obtainedMarks` checked `min: 0` but allowed values greater than `totalMarks`. | Added custom validation rule checking `obtainedMarks <= totalMarks` in Express validator. | Tested evaluation creation with `obtainedMarks > totalMarks`; verified 400 Bad Request error. |
| **SEC-08** | Rate Limiting | `server/app.js`, `server/src/routes/auth.routes.js` | MEDIUM | Global rate limiting active (200 req/15m) and auth route rate limiting active (100 req/15m). | Maintained structured rate limiters on sensitive login, register, upload, and evaluation endpoints to prevent brute force and denial of service. | Tested repeated request bursts; verified 429 Too Many Requests response. |
| **SEC-09** | Database Indexing | `server/src/models/AnswerSheet.js`, `Evaluation.js` | LOW | Missing compound indexes on high-frequency query filters. | Created compound Mongoose indexes: `{ student: 1, isDeleted: 1 }`, `{ exam: 1, isDeleted: 1 }`, `{ student: 1, exam: 1, isDeleted: 1 }`, `{ answerSheet: 1, isDeleted: 1 }`. | Evaluated query execution plans and verified faster lookup performance. |
| **SEC-10** | OCR File Security | `ocr-service/app/routers/pipeline_router.py` | MEDIUM | Image uploads required format and dimension validation. | Enforced file size limits (`OCR_MAX_UPLOAD_SIZE_MB`), MIME type checking (`image/jpeg`, `image/png`, `image/webp`), and pixel dimension boundary checks (`<= 8000x8000`). | Uploaded oversized files and non-image formats; verified clean rejection. |
| **SEC-11** | AI Failure Safety | `server/src/services/ai/evaluationPipeline.service.js` | CRITICAL | Ensure AI service failures do not generate fake or mock marks. | Confirmed pipeline assigns status `failed`, sets error message, sets confidence to `0`, and flags for manual faculty review on failure. | Simulated LLM service interruption; verified evaluation status transitions to `failed` without assigning fake marks. |
| **SEC-12** | Concurrency Lock | `server/src/services/ai/evaluationPipeline.service.js` | MEDIUM | Unchecked concurrent evaluation clicks could trigger duplicate processing. | Implemented atomic state transitions using `findOneAndUpdate` on `AnswerSheet` to lock active evaluation states (`ACTIVE_EVALUATION_STATES`). | Sent concurrent evaluation triggers; verified second request receives `409 Conflict` ("EVALUATION_ALREADY_RUNNING"). |

---

## 3. DETAILED COMPONENT AUDITS

### A. Authentication & Authorization
- **Password Storage**: Passwords are securely hashed using `bcrypt` (10 salt rounds) before persistence (`User.js` pre-save hook).
- **JWT Handling**: Access tokens are signed using standard JWT algorithms with configured expirations (`15m` access, `7d` refresh). Passwords and sensitive fields are stripped via `toJSON` instance method overrides.
- **Role-Based Access Control (RBAC)**: All protected routes enforce `authMiddleware` and `authorizeRoles(ROLES...)`. Student, Faculty, and Admin privileges are isolated server-side.

### B. Input & Data Integrity
- **Marks Validation**: All marks parameters (`obtainedMarks`, `maximumMarks`, `facultyMarks`) enforce non-negative numbers and upper boundary limits (`obtainedMarks <= totalMarks`).
- **Object ID Validation**: Database query inputs validate MongoDB `ObjectId` structures to prevent malformed query exceptions or injection attempts.

### C. OCR Microservice Security
- **Service Boundaries**: Python FastAPI OCR service runs isolated on `127.0.0.1:8000`. Express backend proxies specific OCR endpoints while enforcing authentication.
- **Resource Protection**: Image processing operations execute safely in separate threads using `asyncio.to_thread` with explicit memory cleanup.

### D. AI Evaluation Reliability & Safety
- **No Mock Evaluation**: The live evaluation pipeline requires valid reference answers/rubrics and real LLM evaluation.
- **Prompt Safety**: Prompts strictly segregate system instructions, rubrics, model answers, and student responses to prevent prompt injection or override attacks.
- **Idempotency**: Atomic status transitions prevent duplicate evaluations on multi-click.

---

## 4. VERIFICATION SIGN-OFF

All fixes documented in this audit report have been implemented and verified against the live codebase.
