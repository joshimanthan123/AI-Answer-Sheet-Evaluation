import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AI-Based Automated Answer Sheet Evaluation System API",
    version: "1.0.0",
    description: `
### Backend API Documentation & Testing Interface

This is the production OpenAPI 3.0 specification for the **AI-Based Automated Answer Sheet Evaluation System** Express Backend (\`http://localhost:5000\`).

It enables interactive testing of all authentication, exam management, student submissions, digital answer sheets, OCR bridge integration, AI evaluation pipelines, results publication, and administrative reporting features.

#### Key Features:
- **Authentication**: JWT Bearer token authentication (\`Authorization: Bearer <JWT>\`).
- **Student Exam Portal**: Exam eligibility, digital answer workspace, auto-saving, final submission, and result breakdown.
- **Faculty Review Suite**: Question bank management, answer key finalization, manual overrides, AI evaluation triggers, and result publication.
- **AI Evaluation & OCR Bridge**: Seamless proxying and communication with Python FastAPI OCR Microservice (\`http://127.0.0.1:8000\`).
    `,
    contact: {
      name: "AI Evaluation Engineering Team",
      email: "support@aieval.internal",
    },
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Express Backend Local Server (Root)",
    },
    {
      url: "http://localhost:5000/api",
      description: "Express Backend API Base",
    },
    {
      url: "http://localhost:5000/api/v1",
      description: "Express Backend API v1 Base",
    },
  ],
  tags: [
    { name: "Health & System", description: "System status and health check endpoints" },
    { name: "Authentication", description: "User registration, login, JWT token refresh, profile management" },
    { name: "Departments", description: "Academic department management" },
    { name: "Courses", description: "Degree program & course structure management" },
    { name: "Subjects", description: "Subject & course unit configuration" },
    { name: "Exams", description: "Exam lifecycle, schedule, instructions, question bank management" },
    { name: "Answer Keys", description: "Faculty answer key creation, file upload, approval, and locking" },
    { name: "Submissions & Answer Sheets", description: "Student submissions, digital answers, file upload, status" },
    { name: "AI Evaluation & OCR", description: "Triggering AI evaluation, status tracking, evaluation reports, OCR bridge" },
    { name: "Evaluations", description: "Evaluation records, question-level review, score overrides, finalization" },
    { name: "Results & Reports", description: "Published student marks, exam analytics, summary reports, CSV export" },
    { name: "Student Portal", description: "Student dashboard, exam workspace, submission status, results" },
    { name: "Faculty Portal", description: "Faculty dashboard, review queue, grading workspace, result publication" },
    { name: "Admin Portal", description: "Administrative dashboard and global management" },
    { name: "Feedback", description: "Student and user system feedback submission" },
    { name: "Notifications", description: "System notifications and alert management" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token obtained from `/api/auth/login` or `/api/auth/register`",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operation executed successfully." },
          data: { type: "object" },
        },
      },
      ApiErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error description message." },
          statusCode: { type: "integer", example: 400 },
          errors: { type: "array", items: { type: "string" } },
        },
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66d6a1b2c3d4e5f6a7b8c9d0" },
          name: { type: "string", example: "John Doe" },
          email: { type: "string", format: "email", example: "john.doe@university.edu" },
          role: { type: "string", enum: ["student", "faculty", "admin"], example: "student" },
          department: { type: "string", example: "Computer Engineering" },
          rollNo: { type: "string", example: "21CE045" },
          employeeId: { type: "string", example: "EMP9823" },
          semester: { type: "integer", example: 5 },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "student@university.edu" },
          password: { type: "string", format: "password", example: "Password123!" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
          name: { type: "string", example: "Alex Smith" },
          email: { type: "string", format: "email", example: "alex.smith@university.edu" },
          password: { type: "string", format: "password", example: "Password123!" },
          role: { type: "string", enum: ["student", "faculty", "admin"], example: "student" },
          department: { type: "string", example: "Computer Engineering" },
          rollNo: { type: "string", example: "21CE099" },
          employeeId: { type: "string", example: "FAC042" },
          semester: { type: "integer", example: 5 },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Authentication successful." },
          data: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
              token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
              refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            },
          },
        },
      },
      Question: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66d6b1c2d3e4f5a6b7c8d9e0" },
          questionNumber: { type: "integer", example: 1 },
          title: { type: "string", example: "Process Synchronization" },
          questionText: { type: "string", example: "Explain Peterson's Algorithm for mutual exclusion." },
          maxMarks: { type: "number", example: 10 },
          modelAnswer: { type: "string", example: "Peterson's Algorithm is a concurrent programming algorithm..." },
          keywords: { type: "array", items: { type: "string" }, example: ["critical section", "mutual exclusion", "turn"] },
          rubric: {
            type: "object",
            properties: {
              keyConcepts: { type: "array", items: { type: "string" } },
              scoringCriteria: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
      Exam: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66d6c1d2e3f4a5b6c7d8e9f0" },
          title: { type: "string", example: "Operating Systems Mid-Semester Exam" },
          code: { type: "string", example: "CS302-MID" },
          subject: { type: "string", example: "66d6a0000000000000000001" },
          department: { type: "string", example: "Computer Engineering" },
          semester: { type: "integer", example: 5 },
          totalMarks: { type: "number", example: 50 },
          durationMinutes: { type: "integer", example: 120 },
          status: { type: "string", enum: ["draft", "published", "active", "completed", "archived"], example: "active" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          questions: { type: "array", items: { $ref: "#/components/schemas/Question" } },
          instructions: { type: "array", items: { type: "string" } },
        },
      },
      AnswerSheet: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66d6d1e2f3a4b5c6d7e8f9a0" },
          exam: { type: "string", example: "66d6c1d2e3f4a5b6c7d8e9f0" },
          student: { type: "string", example: "66d6a1b2c3d4e5f6a7b8c9d0" },
          status: { type: "string", enum: ["in_progress", "submitted", "evaluating", "evaluated", "reviewed"], example: "evaluated" },
          answers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionNumber: { type: "integer", example: 1 },
                answerText: { type: "string", example: "Peterson's algorithm achieves mutual exclusion by..." },
                handwrittenData: { type: "string", example: "/uploads/handwritten_ans_1.png" },
                ocrTranscribedText: { type: "string", example: "Peterson's algorithm achieves mutual exclusion..." },
              },
            },
          },
          totalMarksObtained: { type: "number", example: 42 },
          isEvaluated: { type: "boolean", example: true },
          evaluatedAt: { type: "string", format: "date-time" },
        },
      },
      Evaluation: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66d6e1f2a3b4c5d6e7f8a9b0" },
          answerSheet: { type: "string", example: "66d6d1e2f3a4b5c6d7e8f9a0" },
          exam: { type: "string", example: "66d6c1d2e3f4a5b6c7d8e9f0" },
          student: { type: "string", example: "66d6a1b2c3d4e5f6a7b8c9d0" },
          status: { type: "string", enum: ["pending", "processing", "completed", "failed"], example: "completed" },
          totalScore: { type: "number", example: 42 },
          maxPossibleScore: { type: "number", example: 50 },
          percentage: { type: "number", example: 84 },
          overallFeedback: { type: "string", example: "Excellent understanding of core synchronization primitives." },
          questionEvaluations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionNumber: { type: "integer", example: 1 },
                marksAwarded: { type: "number", example: 9 },
                maxMarks: { type: "number", example: 10 },
                similarityScore: { type: "number", example: 0.88 },
                keywordCoverage: { type: "number", example: 0.90 },
                feedback: { type: "string", example: "Correct explanation of turn variable and flag array." },
                manualOverride: { type: "boolean", example: false },
              },
            },
          },
        },
      },
      StrokeData: {
        type: "object",
        properties: {
          x: { type: "array", items: { type: "number" }, example: [10, 15, 20, 25] },
          y: { type: "array", items: { type: "number" }, example: [50, 52, 55, 60] },
          t: { type: "array", items: { type: "number" }, example: [100, 120, 140, 160] },
        },
      },
      RecognizeStrokesRequest: {
        type: "object",
        required: ["strokes"],
        properties: {
          strokes: {
            type: "array",
            items: { $ref: "#/components/schemas/StrokeData" },
          },
          pageNumber: { type: "integer", example: 1 },
          language: { type: "string", example: "en" },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: [
    "./src/routes/*.js",
    "./src/routes/api-docs-paths.js",
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
export { swaggerSpec };
