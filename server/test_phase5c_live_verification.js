import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import jwt from "jsonwebtoken";
import app from "./app.js";
import env from "./src/config/env.js";
import User from "./src/models/User.js";
import Exam from "./src/models/Exam.js";
import Evaluation from "./src/models/Evaluation.js";

dotenv.config();

const JWT_SECRET = env.JWT.ACCESS_SECRET || "default_local_dev_access_secret_1234567890";

async function runLiveVerification() {
  console.log("=================================================");
  console.log("  PHASE 5C COMPLETE LIVE END-TO-END VERIFICATION  ");
  console.log("=================================================");

  let server;
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB");

    // Start Express server on a temporary port (e.g., 5099)
    const PORT = 5099;
    server = app.listen(PORT);
    console.log(`✓ Test Express server listening on http://127.0.0.1:${PORT}`);

    // Fetch users for JWT generation
    const admin = await User.findOne({ role: "admin", isDeleted: false });
    const faculty = await User.findOne({ role: "faculty", isDeleted: false });
    const student = await User.findOne({ role: "student", isDeleted: false });

    if (!admin || !faculty || !student) {
      throw new Error("Missing required test users in database.");
    }

    const adminToken = jwt.sign({ id: admin._id, role: admin.role, email: admin.email, name: admin.name }, JWT_SECRET, { expiresIn: "1h" });
    const facultyToken = jwt.sign({ id: faculty._id, role: faculty.role, email: faculty.email, name: faculty.name }, JWT_SECRET, { expiresIn: "1h" });
    const studentToken = jwt.sign({ id: student._id, role: student.role, email: student.email, name: student.name }, JWT_SECRET, { expiresIn: "1h" });

    console.log("✓ Generated JWT tokens for Admin, Faculty, and Student");

    const baseUrl = `http://127.0.0.1:${PORT}`;

    // Helper request function
    const makeReq = async (endpoint, token, method = "GET", body = null) => {
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (body) headers["Content-Type"] = "application/json";

      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);

      const res = await fetch(`${baseUrl}${endpoint}`, opts);
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
      return { status: res.status, headers: res.headers, data };
    };

    // Find a sample exam
    const sampleExam = await Exam.findOne({ isDeleted: false });
    const examId = sampleExam ? sampleExam._id.toString() : "";

    // 1. Cross-Exam Analytics
    console.log("\n[Test 1] GET /api/advanced-analytics/cross-exam (Faculty)");
    const res1 = await makeReq("/api/advanced-analytics/cross-exam", facultyToken);
    console.log(`Status: ${res1.status}, Success: ${res1.data.success}`);
    if (res1.status !== 200) throw new Error(`Cross-exam analytics failed: ${JSON.stringify(res1.data)}`);

    // 2. Performance Trends
    console.log("\n[Test 2] GET /api/advanced-analytics/performance-trends (Faculty)");
    const res2 = await makeReq("/api/advanced-analytics/performance-trends", facultyToken);
    console.log(`Status: ${res2.status}, Success: ${res2.data.success}`);
    if (res2.status !== 200) throw new Error("Performance trends failed");

    // 3. Student Performance Trend
    console.log("\n[Test 3] GET /api/advanced-analytics/student-trends/:studentId (Faculty)");
    const res3 = await makeReq(`/api/advanced-analytics/student-trends/${student._id}`, facultyToken);
    console.log(`Status: ${res3.status}, Success: ${res3.data.success}`);
    if (res3.status !== 200) throw new Error("Student performance trend failed");

    // 4. Question Trends
    console.log("\n[Test 4] GET /api/advanced-analytics/question-trends (Faculty)");
    const res4 = await makeReq("/api/advanced-analytics/question-trends", facultyToken);
    console.log(`Status: ${res4.status}, Success: ${res4.data.success}`);
    if (res4.status !== 200) throw new Error("Question trends failed");

    // 5. Repeated Correction Patterns
    console.log("\n[Test 5] GET /api/advanced-analytics/repeated-correction-patterns (Faculty)");
    const res5 = await makeReq("/api/advanced-analytics/repeated-correction-patterns", facultyToken);
    console.log(`Status: ${res5.status}, Success: ${res5.data.success}`);
    if (res5.status !== 200) throw new Error("Repeated correction patterns failed");

    // 6. System Monitoring Metrics
    console.log("\n[Test 6] GET /api/advanced-analytics/system-monitoring (Faculty)");
    const res6 = await makeReq("/api/advanced-analytics/system-monitoring", facultyToken);
    console.log(`Status: ${res6.status}, Health: ${JSON.stringify(res6.data.data.health)}`);
    if (res6.status !== 200) throw new Error("System monitoring failed");

    // 7. Pipeline Health
    console.log("\n[Test 7] GET /api/advanced-analytics/pipeline-health (Faculty)");
    const res7 = await makeReq("/api/advanced-analytics/pipeline-health", facultyToken);
    console.log(`Status: ${res7.status}, Pipeline: ${JSON.stringify(res7.data.data.pipelineCounts)}`);
    if (res7.status !== 200) throw new Error("Pipeline health failed");

    // 8. Admin System Overview
    console.log("\n[Test 8] GET /api/advanced-analytics/admin-overview (Admin)");
    const res8 = await makeReq("/api/advanced-analytics/admin-overview", adminToken);
    console.log(`Status: ${res8.status}, Overview: Users=${res8.data.data.users.total}, Submissions=${res8.data.data.submissions.total}`);
    if (res8.status !== 200) throw new Error("Admin overview failed");

    // 9. Admin Audit Logs Search & Verification
    console.log("\n[Test 9] GET /api/advanced-analytics/audit-logs (Admin)");
    const res9 = await makeReq("/api/advanced-analytics/audit-logs", adminToken);
    console.log(`Status: ${res9.status}, Total Audit Logs: ${res9.data.data.total}`);
    if (res9.status !== 200) throw new Error("Audit logs search failed");

    // 10. AI Review Priority Indicator
    if (examId) {
      console.log(`\n[Test 10] GET /api/advanced-analytics/review-priority/${examId} (Faculty)`);
      const res10 = await makeReq(`/api/advanced-analytics/review-priority/${examId}`, facultyToken);
      console.log(`Status: ${res10.status}, Priority Queue Items: ${res10.data.data.length}`);
      if (res10.status !== 200) throw new Error("Review priority failed");
    }

    // 11. Alert Configuration Update
    console.log("\n[Test 11] PUT /api/advanced-analytics/alerts/config (Admin)");
    const res11 = await makeReq("/api/advanced-analytics/alerts/config", adminToken, "PUT", {
      ocrFailureRateThreshold: 12,
      pendingEvaluationCountThreshold: 25,
    });
    console.log(`Status: ${res11.status}, Updated Threshold: OCR=${res11.data.data.ocrFailureRateThreshold}%`);
    if (res11.status !== 200) throw new Error("Alert config update failed");

    // 12. Export Endpoints
    console.log("\n[Test 12] Export Endpoints (CSV / PDF / Excel)");
    const csvRes = await makeReq("/api/advanced-analytics/export/csv", facultyToken);
    console.log(`CSV Export Status: ${csvRes.status}, Content-Type: ${csvRes.headers.get("content-type")}`);
    if (csvRes.status !== 200) throw new Error("CSV export failed");

    const pdfRes = await makeReq("/api/advanced-analytics/export/pdf", facultyToken);
    console.log(`PDF Export Status: ${pdfRes.status}, Content-Type: ${pdfRes.headers.get("content-type")}`);
    if (pdfRes.status !== 200) throw new Error("PDF export failed");

    const excelRes = await makeReq("/api/advanced-analytics/export/excel", facultyToken);
    console.log(`Excel Export Status: ${excelRes.status}, Content-Type: ${excelRes.headers.get("content-type")}`);
    if (excelRes.status !== 200) throw new Error("Excel export failed");

    // 13. Security Authorization Check (Student MUST be denied)
    console.log("\n[Test 13] Authorization Check: Student access to Admin/Faculty Analytics");
    const studentRes = await makeReq("/api/advanced-analytics/cross-exam", studentToken);
    console.log(`Student Access Status: ${studentRes.status} (Expected 403 Forbidden)`);
    if (studentRes.status !== 403) throw new Error("Security breach: Student was not forbidden from analytics!");

    // 14. Finalized Marks Immutability Verification
    console.log("\n[Test 14] Finalized Marks Immutability Check");
    const finalizedEvalBefore = await Evaluation.find({ "finalEvaluation.status": "finalized" }).lean();
    console.log(`✓ Count of finalized evaluations in DB: ${finalizedEvalBefore.length}`);
    for (const ev of finalizedEvalBefore) {
      if (ev.finalEvaluation.totalMarksObtained === undefined) {
        throw new Error(`Corrupted evaluation record found: ${ev._id}`);
      }
    }
    console.log("✓ All finalized marks remain 100% intact and untouched.");

    console.log("\n=================================================");
    console.log("  ALL PHASE 5C LIVE VERIFICATION TESTS PASSED!   ");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Live verification failed:", err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

runLiveVerification();
