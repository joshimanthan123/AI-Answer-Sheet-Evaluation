/**
 * @openapi
 * /health:
 *   get:
 *     summary: System Health Check
 *     description: Returns current process uptime, database connection state, and system health status.
 *     tags: [Health & System]
 *     responses:
 *       200:
 *         description: System is operational
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'

 * /api:
 *   get:
 *     summary: API Base Endpoint
 *     description: Returns API online status message.
 *     tags: [Health & System]
 *     responses:
 *       200:
 *         description: API is online

 * /api/auth/register:
 *   post:
 *     summary: Register User
 *     description: Register a student, faculty member, or system administrator.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or user already exists

 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     description: Authenticate with email and password to receive JWT tokens.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials

 * /api/auth/logout:
 *   post:
 *     summary: Logout User
 *     description: Invalidates active JWT token session and clears cookies.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully

 * /api/auth/profile:
 *   get:
 *     summary: Get Profile
 *     description: Returns profile details of the authenticated user.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User profile payload

 * /api/auth/me:
 *   get:
 *     summary: Get Current User
 *     description: Alias for `/api/auth/profile`.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User profile payload

 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT Token
 *     description: Obtain a new access token using a valid refresh token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued

 * /api/departments:
 *   get:
 *     summary: Get All Departments
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: List of academic departments
 *   post:
 *     summary: Create Department
 *     tags: [Departments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string, example: "Computer Engineering" }
 *               code: { type: string, example: "CE" }
 *     responses:
 *       201:
 *         description: Department created

 * /api/departments/{id}:
 *   get:
 *     summary: Get Department by ID
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department details
 *   put:
 *     summary: Update Department
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department updated
 *   delete:
 *     summary: Delete Department
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department deleted

 * /api/courses:
 *   get:
 *     summary: Get All Courses
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: List of courses
 *   post:
 *     summary: Create Course
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code, durationYears, totalSemesters, department]
 *             properties:
 *               name: { type: string, example: "B.Tech Computer Engineering" }
 *               code: { type: string, example: "BTCE" }
 *               durationYears: { type: integer, example: 4 }
 *               totalSemesters: { type: integer, example: 8 }
 *               department: { type: string, example: "66d6a0000000000000000001" }
 *     responses:
 *       201:
 *         description: Course created

 * /api/courses/{id}:
 *   get:
 *     summary: Get Course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course details
 *   put:
 *     summary: Update Course
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course updated
 *   delete:
 *     summary: Delete Course
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course deleted

 * /api/subjects:
 *   get:
 *     summary: Get All Subjects
 *     tags: [Subjects]
 *     responses:
 *       200:
 *         description: List of subjects
 *   post:
 *     summary: Create Subject
 *     tags: [Subjects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string, example: "Operating Systems" }
 *               code: { type: string, example: "CS302" }
 *               course: { type: string }
 *               semester: { type: integer, example: 5 }
 *               credits: { type: number, example: 4 }
 *     responses:
 *       201:
 *         description: Subject created

 * /api/subjects/{id}:
 *   get:
 *     summary: Get Subject by ID
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subject details
 *   put:
 *     summary: Update Subject
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subject updated
 *   delete:
 *     summary: Delete Subject
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subject deleted

 * /api/exams:
 *   get:
 *     summary: Get All Exams
 *     tags: [Exams]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of exams
 *   post:
 *     summary: Create Exam
 *     tags: [Exams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, code, subject, totalMarks, durationMinutes]
 *             properties:
 *               title: { type: string, example: "OS Mid-Sem Exam" }
 *               code: { type: string, example: "CS302-MID" }
 *               subject: { type: string }
 *               department: { type: string }
 *               semester: { type: integer, example: 5 }
 *               totalMarks: { type: number, example: 50 }
 *               durationMinutes: { type: integer, example: 120 }
 *               startDate: { type: string, format: "date-time" }
 *               endDate: { type: string, format: "date-time" }
 *     responses:
 *       201:
 *         description: Exam created successfully

 * /api/exams/{id}:
 *   get:
 *     summary: Get Exam by ID
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam details
 *   put:
 *     summary: Update Exam
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam updated
 *   delete:
 *     summary: Delete Exam
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam deleted

 * /api/exams/{examId}/questions:
 *   post:
 *     summary: Add Question to Exam Question Bank
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Question'
 *     responses:
 *       201:
 *         description: Question added

 * /api/exams/{examId}/questions/reorder:
 *   post:
 *     summary: Reorder Exam Questions
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderedQuestionIds]
 *             properties:
 *               orderedQuestionIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Questions reordered successfully

 * /api/exams/{examId}/questions/{questionId}:
 *   put:
 *     summary: Update Question
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Question updated
 *   delete:
 *     summary: Delete Question
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Question removed

 * /api/exams/{examId}/start:
 *   post:
 *     summary: Start Exam Session
 *     tags: [Exams, Student Portal]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam session initiated

 * /api/exams/{examId}/autosave:
 *   post:
 *     summary: Autosave Student Answer
 *     tags: [Exams, Student Portal]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionNumber]
 *             properties:
 *               questionNumber: { type: integer, example: 1 }
 *               answerText: { type: string, example: "Draft answer content" }
 *     responses:
 *       200:
 *         description: Draft saved

 * /api/exams/{examId}/submit:
 *   post:
 *     summary: Submit Final Exam Answers
 *     tags: [Exams, Student Portal]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam submitted successfully

 * /api/exams/{examId}/status:
 *   get:
 *     summary: Check Exam Submission Status
 *     tags: [Exams, Submissions & Answer Sheets]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Submission status details

 * /api/exams/{examId}/instructions:
 *   get:
 *     summary: Get Exam Instructions
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of instructions

 * /api/exams/{examId}/evaluate:
 *   post:
 *     summary: Trigger Bulk Evaluation for Exam Submissions
 *     tags: [Exams, AI Evaluation & OCR]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bulk evaluation triggered

 * /api/exams/{examId}/results:
 *   get:
 *     summary: Get Results Breakdown for Exam
 *     tags: [Exams, Results & Reports]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exam results list

 * /api/exams/{examId}/analytics:
 *   get:
 *     summary: Get Exam Performance Analytics
 *     tags: [Exams, Results & Reports]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Performance statistics and analytics

 * /api/exams/{examId}/results/export:
 *   get:
 *     summary: Export Exam Results as CSV
 *     tags: [Exams, Results & Reports]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file payload
 *         content:
 *           text/csv:
 *             schema: { type: string }

 * /api/exams/{examId}/results/report:
 *   get:
 *     summary: Download Summary Report PDF
 *     tags: [Exams, Results & Reports]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PDF summary report

 * /api/answer-sheets:
 *   get:
 *     summary: Get All Answer Sheets
 *     tags: [Submissions & Answer Sheets]
 *     responses:
 *       200:
 *         description: List of submitted answer sheets
 *   post:
 *     summary: Create Answer Sheet / Upload Digital Pages
 *     tags: [Submissions & Answer Sheets]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               exam: { type: string }
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             required: [exam]
 *             properties:
 *               exam: { type: string }
 *               answers: { type: array, items: { type: object } }
 *     responses:
 *       201:
 *         description: Answer sheet created/uploaded

 * /api/answer-sheets/{id}:
 *   get:
 *     summary: Get Answer Sheet Details by ID
 *     tags: [Submissions & Answer Sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Answer sheet payload
 *   put:
 *     summary: Update Answer Sheet
 *     tags: [Submissions & Answer Sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated answer sheet
 *   delete:
 *     summary: Delete Answer Sheet
 *     tags: [Submissions & Answer Sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Answer sheet deleted

 * /api/answer-sheets/{id}/digital:
 *   get:
 *     summary: Get OCR Transcribed Digital Answers
 *     tags: [Submissions & Answer Sheets, AI Evaluation & OCR]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transcribed text entries

 * /api/answer-sheets/{id}/evaluate:
 *   post:
 *     summary: Start AI Evaluation for Answer Sheet
 *     tags: [Submissions & Answer Sheets, AI Evaluation & OCR]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Evaluation queued

 * /api/ai/evaluate/{answerSheetId}:
 *   post:
 *     summary: Trigger AI Evaluation Microservice Workflow
 *     tags: [AI Evaluation & OCR]
 *     parameters:
 *       - in: path
 *         name: answerSheetId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Evaluation completed or status returned

 * /api/ai/status/{evaluationId}:
 *   get:
 *     summary: Get AI Evaluation Job Status
 *     tags: [AI Evaluation & OCR]
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Job status and progress percentage

 * /api/ai/report/{evaluationId}:
 *   get:
 *     summary: Get Full AI Evaluation Report
 *     tags: [AI Evaluation & OCR, Results & Reports]
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Evaluation report payload

 * /api/faculty/answer-key/upload:
 *   post:
 *     summary: Upload Answer Key File
 *     tags: [Answer Keys, Faculty Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [examId, answerKeyFile]
 *             properties:
 *               examId: { type: string }
 *               answerKeyFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Answer key file uploaded and parsed

 * /api/faculty/answer-key/{examId}:
 *   get:
 *     summary: Get Answer Key for Exam
 *     tags: [Answer Keys, Faculty Portal]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Answer key payload

 * /api/student/answer-sheet/upload:
 *   post:
 *     summary: Student Upload Answer Sheet File
 *     tags: [Submissions & Answer Sheets, Student Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [examId, answerSheetFile]
 *             properties:
 *               examId: { type: string }
 *               answerSheetFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Handwritten answer sheet uploaded

 * /api/student/dashboard:
 *   get:
 *     summary: Student Dashboard Summary
 *     tags: [Student Portal]
 *     responses:
 *       200:
 *         description: Dashboard statistics and active exams

 * /api/student/results:
 *   get:
 *     summary: Get Student Published Results
 *     tags: [Student Portal, Results & Reports]
 *     responses:
 *       200:
 *         description: List of published student results

 * /api/faculty/dashboard:
 *   get:
 *     summary: Faculty Dashboard Summary
 *     tags: [Faculty Portal]
 *     responses:
 *       200:
 *         description: Faculty stats, active exams, pending review queue

 * /api/faculty/review-queue:
 *   get:
 *     summary: Get Answer Sheet Review Queue
 *     tags: [Faculty Portal]
 *     responses:
 *       200:
 *         description: Answer sheets pending faculty review

 * /api/faculty/results/publish:
 *   post:
 *     summary: Publish Exam Results
 *     tags: [Faculty Portal, Results & Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [examId]
 *             properties:
 *               examId: { type: string }
 *     responses:
 *       200:
 *         description: Results published to students

 * /api/admin/dashboard:
 *   get:
 *     summary: Admin System Dashboard
 *     tags: [Admin Portal]
 *     responses:
 *       200:
 *         description: Global metrics, user counts, exam stats
 */
export default {};
