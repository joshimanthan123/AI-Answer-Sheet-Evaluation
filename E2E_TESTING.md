# Playwright E2E Testing System Documentation

This document provides complete instructions for running the **FREE End-to-End (E2E) Testing System using Playwright** for the **AI-Based Automated Answer Sheet Evaluation System**.

The E2E test suite interacts directly with real running services—**React/Vite Frontend** (Port `5173`), **Express Node.js Backend** (Port `5000`), **FastAPI PaddleOCR Service** (Port `8000`), and **MongoDB**—with **zero mock API responses or faked data**.

---

## 1. Environment Requirements & Ports

| Service | Technology | Default Port | URL |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | `5173` | `http://localhost:5173` |
| **Backend API** | Node.js + Express | `5000` | `http://localhost:5000` |
| **OCR Service** | FastAPI + PaddleOCR (Python 3.11) | `8000` | `http://localhost:8000` |
| **Database** | MongoDB | `27017` | `mongodb://localhost:27017/ai_evaluation_db` |

---

## 2. Test Account Credentials

The testing suite reads credentials from environment variables, falling back to seeded test accounts:

| Role | Environment Variables | Default Fallback Email | Default Fallback Password |
| :--- | :--- | :--- | :--- |
| **Faculty** | `E2E_FACULTY_EMAIL`, `E2E_FACULTY_PASSWORD` | `faculty@test.com` | `Password123!` |
| **Student** | `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD` | `student@test.com` | `Password123!` |
| **Admin** | `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | `admin@test.com` | `Password123!` |

---

## 3. How to Start System Services

Before running E2E tests, ensure all three services are running:

### Step 1: Start MongoDB
Ensure MongoDB daemon is running locally on port `27017`.

### Step 2: Seed Test Data & Start Express Backend
```bash
cd server
node scripts/seed_real_e2e_data.js
npm start
```

### Step 3: Start FastAPI OCR Service
```bash
cd ocr-service
# Activate python 3.11 virtual environment if applicable
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 4: Start React Frontend
```bash
cd client
npm run dev
```

---

## 4. Running Playwright E2E Tests

From the project root directory (`d:\CE\sem5\SGP\Ai based evaluation sheet`), run any of the following commands:

### Run All E2E Tests (Headless)
```bash
npx playwright test
# OR using npm script:
npm run test:e2e
```

### Run Tests in Headed Mode (Visual Browser Window)
```bash
npx playwright test --headed
# OR using npm script:
npm run test:e2e:headed
```

### Run Tests in Interactive UI Mode
```bash
npx playwright test --ui
# OR using npm script:
npm run test:e2e:ui
```

### Run a Specific Test Suite
```bash
# Auth spec:
npx playwright test tests/auth/auth.spec.ts

# Reference Answer upload spec:
npx playwright test tests/reference-answer/reference-upload.spec.ts

# Reference Answer OCR & Segmentation spec:
npx playwright test tests/reference-answer/reference-ocr-verify.spec.ts

# Master End-to-End full pipeline spec:
npx playwright test tests/e2e/full-master.spec.ts
```

### View Playwright HTML Test Report
```bash
npx playwright show-report
# OR using npm script:
npm run test:e2e:report
```

---

## 5. Test Directory Overview

```text
tests/
├── auth/
│   └── auth.spec.ts                 # Valid & invalid authentication specs
├── portal/
│   └── portal-navigation.spec.ts    # Portal navigation & layout specs
├── reference-answer/
│   ├── reference-upload.spec.ts     # Reference answer sheet upload flow
│   └── reference-ocr-verify.spec.ts # Real PaddleOCR extraction & question segmentation
├── ocr/
│   └── ocr-pipeline.spec.ts         # Live OCR service integration & network monitoring
├── student-answer/
│   └── student-submission.spec.ts   # Student exam submission & attempt logging
├── evaluation/
│   └── ai-evaluation.spec.ts        # Adaptive AI evaluation structural specs
├── review/
│   └── faculty-review.spec.ts       # Faculty review & mark override specs
├── reports/
│   └── reports-analytics.spec.ts    # Phase 6 Reports & Analytics dashboards
├── security/
│   └── roles.spec.ts                # Role-based authorization & direct URL checks
├── network/
│   └── request-loop-detector.spec.ts# Anomaly & infinite re-render loop detector
├── error-handling/
│   └── edge-cases.spec.ts           # Boundary conditions, 404, & error toasts
└── e2e/
    └── full-master.spec.ts          # Master end-to-end evaluation pipeline suite
```

---

## 6. Real Test Data Assets

All test specs use real image assets located in `test-data/`:
- `test-data/reference-answer-sheet.png`: Evaluated reference sheet containing printed & handwritten question text (Q1, Q2, Q3).
- `test-data/student-answer-sheet.png`: Student handwritten submission sheet containing answers mapped to Q1, Q2, and Q3.

---

## 7. Known Environment Limitations

1. **OpenAI API Key**: If the system environment variable `OPENAI_API_KEY` is configured as `mock-api-key-for-development`, evaluation calls to external LLMs will raise an API authentication warning or fallback to structural baseline evaluation. E2E tests check structural integrity without crashing.
2. **PaddleOCR Model Load**: The first execution of PaddleOCR may take 5–10 seconds to load PP-OCRv5 neural models into memory. Test timeouts in `playwright.config.ts` are set to 60s to accommodate model initialization.
