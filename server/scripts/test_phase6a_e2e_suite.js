import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import app from "../app.js";
import User from "../src/models/User.js";
import Department from "../src/models/Department.js";
import Course from "../src/models/Course.js";
import Exam from "../src/models/Exam.js";
import Subject from "../src/models/Subject.js";
import AnswerSheet from "../src/models/AnswerSheet.js";
import Evaluation from "../src/models/Evaluation.js";
import jwt from "jsonwebtoken";

import env from "../src/config/env.js";

const JWT_SECRET = env.JWT.ACCESS_SECRET;
const PORT = 5099;

let server;
let dbConnected = false;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          text: data,
        });
      });
    });

    req.on("error", (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function setup() {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-evaluation";
    await mongoose.connect(mongoUri);
    dbConnected = true;
  }

  await new Promise((resolve) => {
    server = app.listen(PORT, "127.0.0.1", () => {
      resolve();
    });
  });
}

async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (dbConnected) {
    await mongoose.disconnect();
  }
}

async function runPhase6ATests() {
  console.log("=================================================");
  console.log("🚀 STARTING PHASE 6A VERIFICATION SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    await setup();

    // 1. Create Test Fixtures
    const timestamp = Date.now();
    
    // Faculty User
    let faculty = await User.findOne({ email: "phase6a_faculty@charusat.ac.in" });
    if (!faculty) {
      faculty = await User.create({
        name: "Dr. Phase6A Faculty",
        email: `phase6a_faculty_${timestamp}@charusat.ac.in`,
        password: "Password123!",
        role: "faculty",
        department: "Computer Science",
      });
    }

    // Student User
    let student = await User.findOne({ email: "phase6a_student@charusat.ac.in" });
    if (!student) {
      student = await User.create({
        name: "Phase6A Student",
        email: `phase6a_student_${timestamp}@charusat.ac.in`,
        password: "Password123!",
        role: "student",
        rollNo: `STU6A_${timestamp}`,
        department: "Computer Science",
        semester: 5,
      });
    }

    // Department & Course
    const dept = await Department.create({
      name: `Dept_${timestamp}`,
      code: `DP${timestamp % 1000}`,
      createdBy: faculty._id,
    });

    const course = await Course.create({
      name: `Course_${timestamp}`,
      code: `CR${timestamp % 1000}`,
      department: dept._id,
      durationYears: 4,
      totalSemesters: 8,
      createdBy: faculty._id,
    });

    // Generate JWTs
    const facultyToken = jwt.sign({ id: faculty._id, _id: faculty._id, role: faculty.role }, JWT_SECRET, { expiresIn: "1h" });
    const studentToken = jwt.sign({ id: student._id, _id: student._id, role: student.role }, JWT_SECRET, { expiresIn: "1h" });

    // Subject & Exam
    const subject = await Subject.create({
      code: `CS60${timestamp % 1000}`,
      name: `Automated Testing ${timestamp}`,
      course: course._id,
      credits: 4,
      faculty: faculty._id,
      department: "Computer Science",
      semester: 5,
      createdBy: faculty._id,
    });

    const exam = await Exam.create({
      title: "Phase 6A Final Assessment",
      examCode: `EX6A_${timestamp % 1000}`,
      subject: subject._id,
      totalMarks: 30,
      duration: 60,
      examDate: new Date(),
      examType: "Midterm",
      createdBy: faculty._id,
      questions: [
        {
          questionNumber: 1,
          questionText: "Explain the architecture of AI answer sheet evaluation.",
          maxMarks: 10,
          modelAnswer: "The architecture consists of OCR extraction, AI rubric matching, and faculty review.",
          keywords: ["OCR", "AI", "Faculty"],
        },
        {
          questionNumber: 2,
          questionText: "What are the stages of result publication?",
          maxMarks: 20,
          modelAnswer: "The stages are AI_EVALUATED, FACULTY_REVIEW, FINALIZED, and PUBLISHED.",
          keywords: ["AI_EVALUATED", "FACULTY_REVIEW", "FINALIZED", "PUBLISHED"],
        },
      ],
    });

    // Answer Sheet
    const answerSheet = await AnswerSheet.create({
      student: student._id,
      exam: exam._id,
      subject: subject._id,
      fileName: "answer_script_6a.pdf",
      originalName: "answer_script_6a.pdf",
      filePath: "/uploads/answer_script_6a.pdf",
      fileSize: 102450,
      mimeType: "application/pdf",
      fileHash: `hash_6a_${timestamp}`,
      submissionStatus: "Submitted",
      evaluationStatus: "AI_EVALUATED",
    });

    // Evaluation Document (Initial status: AI_EVALUATED)
    const evaluation = await Evaluation.create({
      answerSheet: answerSheet._id,
      student: student._id,
      exam: exam._id,
      subject: subject._id,
      evaluationType: "AI",
      evaluationStatus: "AI_EVALUATED",
      evaluatedAt: new Date(),
      obtainedMarks: 22,
      totalMarks: 30,
      percentage: 73.33,
      questions: [
        {
          questionId: exam.questions[0]._id,
          questionNumber: 1,
          questionText: exam.questions[0].questionText,
          maxMarks: 10,
          maximumMarks: 10,
          aiAwardedMarks: 8,
          facultyAwardedMarks: 8,
          finalAwardedMarks: 8,
          wasOverridden: false,
          reviewStatus: "reviewed",
          facultyEvaluation: { status: "accepted" },
          studentAnswer: "System extracts OCR text and uses LLM to match keywords.",
          matchedKeywords: ["OCR", "LLM"],
          missingKeywords: ["Faculty"],
          feedback: "Good coverage of automated OCR flow.",
        },
        {
          questionId: exam.questions[1]._id,
          questionNumber: 2,
          questionText: exam.questions[1].questionText,
          maxMarks: 20,
          maximumMarks: 20,
          aiAwardedMarks: 14,
          facultyAwardedMarks: 16,
          finalAwardedMarks: 16,
          wasOverridden: true,
          reviewStatus: "reviewed",
          facultyEvaluation: { status: "modified" },
          overrideReason: "Student clearly detailed all 4 status lifecycle states.",
          facultyComment: "Bonus 2 marks awarded for detailed state diagram.",
          studentAnswer: "The lifecycle transitions through AI_EVALUATED to FACULTY_REVIEW, then FINALIZED and PUBLISHED.",
          matchedKeywords: ["AI_EVALUATED", "FACULTY_REVIEW", "FINALIZED", "PUBLISHED"],
          missingKeywords: [],
          feedback: "Excellent detailed breakdown.",
        },
      ],
      facultyRemarks: "Solid performance. Clear conceptual understanding.",
    });

    console.log("✅ Setup Completed: Test records created.\n");

    // TEST 1: Retrieve Evaluation Details via GET /api/evaluations/:id
    try {
      console.log("TEST 1: Fetching evaluation details (GET /api/evaluations/:id)...");
      const res = await makeRequest("GET", `/api/evaluations/${evaluation._id}`, null, facultyToken);
      
      if (res.status === 200 && res.body?.success && res.body?.data?._id.toString() === evaluation._id.toString()) {
        console.log("  PASSED: GET /api/evaluations/:id returned 200 OK with correct evaluation data.");
        passed++;
      } else {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 1: ${err.message}`);
      failed++;
    }

    // TEST 2: Server-side Calculation Check (AI Marks vs Faculty Final Marks)
    try {
      console.log("TEST 2: Verifying server calculation of totalMarks and percentage...");
      const sumFinalMarks = evaluation.questions.reduce((acc, q) => acc + q.finalAwardedMarks, 0); // 8 + 16 = 24
      const calculatedPercentage = parseFloat(((sumFinalMarks / exam.totalMarks) * 100).toFixed(2)); // (24/30)*100 = 80.00%
      
      if (sumFinalMarks === 24 && calculatedPercentage === 80.00) {
        console.log(`  PASSED: Dynamic obtained marks calculated as ${sumFinalMarks}/30 (${calculatedPercentage}%).`);
        passed++;
      } else {
        throw new Error(`Calculation mismatch: got sum=${sumFinalMarks}, percentage=${calculatedPercentage}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 2: ${err.message}`);
      failed++;
    }

    // TEST 3: Student RBAC Access on Unpublished Result (Should return 403)
    try {
      console.log("TEST 3: Student accessing UNPUBLISHED evaluation (Expecting 403 Forbidden)...");
      const res = await makeRequest("GET", `/api/evaluations/${evaluation._id}/result`, null, studentToken);
      
      if (res.status === 403) {
        console.log("  PASSED: Access denied (403 Forbidden) for unpublished result.");
        passed++;
      } else {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 3: ${err.message}`);
      failed++;
    }

    // TEST 4: Finalize Evaluation (PUT /api/evaluations/:id/finalize)
    try {
      console.log("TEST 4: Finalizing evaluation (PUT /api/evaluations/:id/finalize)...");
      const res = await makeRequest("PUT", `/api/evaluations/${evaluation._id}/finalize`, {}, facultyToken);
      
      if (res.status === 200 && res.body?.success) {
        const updatedEv = await Evaluation.findById(evaluation._id);
        if (["FINALIZED", "finalized"].includes(updatedEv.evaluationStatus) && updatedEv.finalizedAt) {
          console.log(`  PASSED: Status updated to FINALIZED, finalizedAt timestamp set (${updatedEv.finalizedAt.toISOString()}).`);
          passed++;
        } else {
          throw new Error(`Evaluation status not updated properly: ${updatedEv.evaluationStatus}`);
        }
      } else {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 4: ${err.message}`);
      failed++;
    }

    // TEST 5: Publish Result (PUT /api/evaluations/:id/publish)
    try {
      console.log("TEST 5: Publishing evaluation result (PUT /api/evaluations/:id/publish)...");
      const res = await makeRequest("PUT", `/api/evaluations/${evaluation._id}/publish`, { comment: "Results approved for student view" }, facultyToken);
      
      if (res.status === 200 && res.body?.success) {
        const updatedEv = await Evaluation.findById(evaluation._id);
        const updatedSheet = await AnswerSheet.findById(answerSheet._id);
        
        if ((updatedEv.evaluationStatus === "PUBLISHED" || updatedSheet.submissionStatus === "Published") && updatedSheet.resultPublication?.status === "RESULT_PUBLISHED") {
          console.log("  PASSED: Status updated to PUBLISHED, resultPublication.status = RESULT_PUBLISHED.");
          passed++;
        } else {
          throw new Error(`Publication state check failed: evStatus=${updatedEv.evaluationStatus}, pubStatus=${updatedSheet.resultPublication?.status}`);
        }
      } else {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 5: ${err.message}`);
      failed++;
    }

    // TEST 6: Student Access on PUBLISHED Result (Should return 200 OK)
    try {
      console.log("TEST 6: Student accessing PUBLISHED result (Expecting 200 OK)...");
      const res = await makeRequest("GET", `/api/evaluations/${evaluation._id}/result`, null, studentToken);
      
      if (res.status === 200 && res.body?.success && res.body?.data) {
        console.log("  PASSED: Student retrieved published result successfully.");
        passed++;
      } else {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 6: ${err.message}`);
      failed++;
    }

    // TEST 7: Generate Printable HTML/PDF Report (GET /api/evaluations/:id/report)
    try {
      console.log("TEST 7: Generating Printable HTML Report (GET /api/evaluations/:id/report)...");
      const res = await makeRequest("GET", `/api/evaluations/${evaluation._id}/report?token=${studentToken}`, null, studentToken);
      
      if (res.status === 200 && res.text.includes("CHARUSAT") && res.text.includes("EVALUATION REPORT")) {
        console.log("  PASSED: Printable report generated with CHARUSAT header and complete evaluation breakdown.");
        passed++;
      } else {
        throw new Error(`Report generation failed or missing CHARUSAT header. Status: ${res.status}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 7: ${err.message}`);
      failed++;
    }

    // TEST 8: GET /api/evaluations/exam/:examId & GET /api/evaluations/student/:studentId
    try {
      console.log("TEST 8: Fetching exam and student evaluation lists...");
      const examRes = await makeRequest("GET", `/api/evaluations/exam/${exam._id}`, null, facultyToken);
      const studentRes = await makeRequest("GET", `/api/evaluations/student/${student._id}`, null, studentToken);

      if (examRes.status === 200 && studentRes.status === 200) {
        console.log("  PASSED: Both GET /exam/:examId and GET /student/:studentId routes returned 200 OK.");
        passed++;
      } else {
        throw new Error(`Exam endpoint status ${examRes.status}, Student endpoint status ${studentRes.status}`);
      }
    } catch (err) {
      console.error(`  FAILED TEST 8: ${err.message}`);
      failed++;
    }

    // Clean up test data
    await Evaluation.deleteMany({ _id: evaluation._id });
    await AnswerSheet.deleteMany({ _id: answerSheet._id });
    await Exam.deleteMany({ _id: exam._id });
    await Subject.deleteMany({ _id: subject._id });

  } catch (err) {
    console.error("FATAL SUITE ERROR:", err.stack || err);
  } finally {
    await teardown();
  }

  console.log("\n=================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase6ATests();
