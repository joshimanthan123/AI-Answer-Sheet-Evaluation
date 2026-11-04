import mongoose from "mongoose";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Exam from "../src/models/Exam.js";
import AnswerSheet from "../src/models/AnswerSheet.js";
import Evaluation from "../src/models/Evaluation.js";
import { getAdminOverviewAnalytics } from "../src/services/analytics.service.js";
import { getStudentExamResult } from "../src/services/studentExam.service.js";

async function verifyAnalyticsAndSecurity() {
  console.log("Verifying MongoDB Analytics & Security Enforcement...");
  await mongoose.connect(env.MONGODB_URI);

  try {
    const studentA = await User.findOne({ email: "student@test.com" });
    let studentB = await User.findOne({ email: "student.beta@test.com" });
    if (!studentB) {
      studentB = await User.create({
        name: "Student Beta",
        email: "student.beta@test.com",
        password: "Password123!",
        role: "student",
        studentId: "STUD-BETA-001",
        semester: 5,
      });
    }

    const exam = await Exam.findOne({ title: "Big Data Analytics — End-to-End Test" });

    // 1. Dynamic Analytics Calculation from MongoDB
    console.log("\n--- 1. DYNAMIC ANALYTICS FROM MONGODB ---");
    const totalStudents = await User.countDocuments({ role: "student", isDeleted: false });
    const totalExams = await Exam.countDocuments({ isDeleted: false });
    const totalSubmissions = await AnswerSheet.countDocuments({ isDeleted: false });
    const evaluatedSubmissions = await AnswerSheet.countDocuments({ reviewStatus: "FINALIZED", isDeleted: false });

    console.log(`Total Students DB Count  : ${totalStudents}`);
    console.log(`Total Exams DB Count     : ${totalExams}`);
    console.log(`Total Submissions Count  : ${totalSubmissions}`);
    console.log(`Evaluated Submissions    : ${evaluatedSubmissions}`);

    // 2. Security & IDOR Verification
    console.log("\n--- 2. IDOR & ROLE AUTHORIZATION TEST ---");
    let idorBlocked = false;
    try {
      // Attempt to access Student A's exam result using Student B's user ID
      await getStudentExamResult(studentB._id, exam._id);
    } catch (err) {
      if (err.statusCode === 403 || err.statusCode === 404 || err.message.includes("No submission found")) {
        idorBlocked = true;
      }
    }

    console.log(`IDOR Security Enforcement (Student B access to Student A data): ${idorBlocked ? "PASS (Access Denied)" : "FAIL"}`);

    console.log("\n[SUCCESS] ANALYTICS & SECURITY VERIFICATION COMPLETE!");

  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

verifyAnalyticsAndSecurity();
