# ARCHITECTURE SPECIFICATION — AI-Based Automated Answer Sheet Evaluation System

**System Name:** AI-Based Automated Answer Sheet Evaluation System  
**Version:** 1.0.0 (Phase 8C Release)  
**Target Environment:** Dockerized Hybrid Microservices Platform  

---

## 1. System Overview & Core Objectives

The **AI-Based Automated Answer Sheet Evaluation System** automates the end-to-end workflow of physical handwritten answer sheet evaluation. It bridges physical student answer submissions with digital OCR transcription, reference-aware AI evaluation, faculty review & calibration, and institutional performance analytics.

### Key Capabilities
1. **Digital & Physical Answer Sheet Ingestion:** Multi-page PDF/image uploads or HTML5 canvas stroke drawing.
2. **OCR & HWR Microservice:** FastAPI microservice utilizing PaddleOCR for bounding box extraction, line-by-line handwriting recognition, and question segmentation.
3. **Reference-Aware AI Evaluation Engine:** Multi-stage prompt construction with answer key matching, rubric criteria scoring, historical reference retrieval, and evidence confidence calculation.
4. **Faculty Review & Calibration Workspace:** Human-in-the-loop review interface allowing faculty to inspect OCR accuracy, override AI marks with justification, and calibrate AI models.
5. **Analytics & Institutional Insights:** Class grade distributions, question difficulty analysis, performance trends, and exportable reports (HTML/PDF/CSV).

---

## 2. High-Level System Architecture

```
                                  +---------------------------------------+
                                  |         Nginx Reverse Proxy           |
                                  |     (Ports 80 / 443 -> Services)      |
                                  +-------------------+-------------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                                                     |
                   v                                                                     v
    +------------------------------+                                   +------------------------------+
    |     Frontend Web Client      |                                   |       Node.js Backend        |
    |  (React 18 + Vite + Tailwind)|                                   |   (Express REST API Server)  |
    +------------------------------+                                   +--------------+---------------+
                                                                                      |
                                            +-----------------------------------------+-----------------------------------------+
                                            |                                         |                                         |
                                            v                                         v                                         v
                             +------------------------------+          +------------------------------+          +------------------------------+
                             |     OCR FastAPI Service      |          |       MongoDB Database       |          |     External LLM Provider    |
                             |   (Python + PaddleOCR)       |          |   (Users, Sheets, Evals)     |          |      (OpenAI / Azure LLM)    |
                             +------------------------------+          +------------------------------+          +------------------------------+
```

---

## 3. Microservice Breakdown

### 3.1 Frontend Client (`client/`)
- **Framework:** React 18 with Vite, Tailwind CSS, Lucide Icons, Recharts.
- **State & Routing:** React Router v6, custom AuthContext, Axios API client.
- **Key Modules:**
  - **Auth:** Login, Register, Role-based route guards (`ProtectedRoute`).
  - **Student Portal:** Exam listing, digital answer canvas, submission workspace, published result viewer.
  - **Faculty Portal:** Exam management, AnswerKey upload, evaluation review dashboard, calibration controls.
  - **Admin Portal:** User management, system audit logs, cross-exam analytics.

### 3.2 Main Backend Server (`server/`)
- **Runtime:** Node.js ES Modules with Express.js framework.
- **Persistence:** MongoDB with Mongoose ORM.
- **Key Services:**
  - `auth.service.js`: JWT access/refresh token lifecycle, bcrypt hashing, cookie handling.
  - `evaluationPipeline.service.js`: Multi-stage AI evaluation queue, attempt tracking, concurrency locking.
  - `referenceRetrieval.service.js`: Historical answer key concept matching and relevance calculation.
  - `calibration.service.js`: Faculty override tracking, delta calculation, and AI model calibration logic.
  - `reportGenerator.service.js`: Dynamic HTML report styling and PDF stream export.

### 3.3 OCR Microservice (`ocr-service/`)
- **Framework:** FastAPI running on Uvicorn.
- **OCR Engine:** PaddleOCR 2.7+ (with optional Azure AI / Google Vision integration).
- **Core Pipeline:**
  1. Image Preprocessing (grayscale, binarization, skew correction using OpenCV).
  2. Bounding Box Detection & Text Recognition.
  3. Question Number Segmentation & Line Mapping.
  4. Response Serialization for Node Backend.

---

## 4. Primary Data Models

- **User:** `_id`, `name`, `email`, `password`, `role` (`student`, `faculty`, `admin`), `department`, `isActive`.
- **Exam:** `_id`, `title`, `examCode`, `subject`, `totalMarks`, `questions` (`questionNumber`, `questionText`, `maximumMarks`, `modelAnswer`, `rubric`), `createdBy`.
- **AnswerSheet:** `_id`, `student`, `exam`, `originalFilename`, `answers` (`questionNumber`, `recognizedText`, `confidence`), `processingStatus`, `evaluationStatus`.
- **Evaluation:** `_id`, `answerSheet`, `obtainedMarks`, `totalMarks`, `percentage`, `grade`, `questions` (`questionId`, `aiMarks`, `finalAwardedMarks`, `feedback`, `criteriaScores`, `facultyEvaluation`), `evaluationStatus`.
- **AnswerKey:** `_id`, `examId`, `version`, `questions` (`questionNumber`, `modelAnswer`, `keywords`, `rubric`), `uploadStatus`.

---

## 5. Security & Protection Layers

1. **Authentication & Authorization:** Dual JWT token architecture (15-min Access Token, 7-day Refresh Token stored in HTTP-Only SameSite cookies) with strict Role-Based Access Control (RBAC).
2. **IDOR & Data Isolation:** Strict query scoping ensuring students access only their own submission results.
3. **HTTP Protection:** Helmet headers (HSTS, X-Content-Type-Options, CSP), Express-Rate-Limit per endpoint, Mongo Sanitize query defense.
4. **Credential Isolation:** Strict separation of environment configurations (`.env`), zero hardcoded secrets in codebase.
