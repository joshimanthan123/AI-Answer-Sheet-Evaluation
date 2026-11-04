import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import User from "../src/models/User.js";
import Department from "../src/models/Department.js";
import Course from "../src/models/Course.js";
import Subject from "../src/models/Subject.js";
import Exam from "../src/models/Exam.js";
import AnswerSheet from "../src/models/AnswerSheet.js";
import Evaluation from "../src/models/Evaluation.js";
import EvaluationFeedback from "../src/models/EvaluationFeedback.js";
import { acceptAiQuestion, overrideQuestion } from "../src/services/facultyReview.service.js";
import * as calibrationService from "../src/services/calibration.service.js";
import { ROLES } from "../src/constants/roles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";

async function runPhase7CVerificationSuite() {
  console.log("=================================================");
  console.log("  PHASE 7C: REVIEW, CALIBRATION & LEARNING TEST ");
  console.log("=================================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✔ Connected to MongoDB successfully.");

    // 1. Setup Test Users & Seeding
    let facultyUser = await User.findOne({ email: "p7c_faculty@example.com" });
    if (!facultyUser) {
      facultyUser = await User.create({
        name: "Dr. Phase 7C Faculty",
        email: "p7c_faculty@example.com",
        password: "hashedpassword123",
        role: ROLES.FACULTY,
      });
    }

    let studentUser = await User.findOne({ email: "p7c_student@example.com" });
    if (!studentUser) {
      studentUser = await User.create({
        name: "Phase 7C Student",
        email: "p7c_student@example.com",
        password: "hashedpassword123",
        role: ROLES.STUDENT,
        rollNo: "P7C-101",
      });
    }

    let testDept = await Department.findOne({ code: "P7CDEPT" });
    if (!testDept) {
      testDept = await Department.create({
        name: "Calibration Engineering",
        code: "P7CDEPT",
        createdBy: facultyUser._id,
      });
    }

    let testCourse = await Course.findOne({ code: "P7CCOURSE" });
    if (!testCourse) {
      testCourse = await Course.create({
        name: "Calibration Science",
        code: "P7CCOURSE",
        durationYears: 4,
        totalSemesters: 8,
        department: testDept._id,
        createdBy: facultyUser._id,
      });
    }

    let testSubject = await Subject.findOne({ code: "P7C101" });
    if (!testSubject) {
      testSubject = await Subject.create({
        name: "Calibration Systems",
        code: "P7C101",
        course: testCourse._id,
        semester: 1,
        credits: 4,
        faculty: facultyUser._id,
        createdBy: facultyUser._id,
      });
    }

    let testExam = await Exam.findOne({ title: "Phase 7C Calibration Midterm" });
    if (!testExam) {
      testExam = await Exam.create({
        title: "Phase 7C Calibration Midterm",
        code: "P7C-EXAM-1",
        examType: "Midterm",
        duration: 60,
        examDate: new Date(),
        subject: testSubject._id,
        createdBy: facultyUser._id,
        totalMarks: 20,
        passingMarks: 8,
      });
    }

    // Clean prior test feedback & evaluations for test exam
    await EvaluationFeedback.deleteMany({ examId: testExam._id });
    const existingSheets = await AnswerSheet.find({ exam: testExam._id });
    const existingSheetIds = existingSheets.map((s) => s._id);
    await Evaluation.deleteMany({ answerSheet: { $in: existingSheetIds } });
    await AnswerSheet.deleteMany({ exam: testExam._id });

    // 2. Create Answer Sheet & Evaluation with AI Results
    const testSheet = await AnswerSheet.create({
      exam: testExam._id,
      student: studentUser._id,
      subject: testSubject._id,
      status: "EVALUATED",
      reviewStatus: "READY_FOR_FACULTY_REVIEW",
      uploadedFileUrl: "/uploads/test_p7c_sheet.pdf",
    });

    const testEval = await Evaluation.create({
      answerSheet: testSheet._id,
      evaluationType: "AI",
      obtainedMarks: 14,
      totalMarks: 20,
      percentage: 70,
      grade: "B",
      evaluationStatus: "AI_EVALUATED",
      reviewStatus: "pending",
      questions: [
        {
          questionNumber: 1,
          questionId: new mongoose.Types.ObjectId(),
          questionText: "Define Machine Learning Calibration.",
          maximumMarks: 10,
          aiMarks: 8,
          aiEvaluation: {
            marksAwarded: 8,
            maxMarks: 10,
            confidence: 0.85,
            matchedConcepts: ["Probability alignment", "Model confidence"],
            missingConcepts: [],
          },
          facultyAwardedMarks: null,
          reviewStatus: "pending",
          referenceAwareEvaluation: {
            referenceAnalysis: { used: true },
          },
        },
        {
          questionNumber: 2,
          questionId: new mongoose.Types.ObjectId(),
          questionText: "Explain concept coverage scoring algorithm.",
          maximumMarks: 10,
          aiMarks: 6,
          aiEvaluation: {
            marksAwarded: 6,
            maxMarks: 10,
            confidence: 0.65,
            matchedConcepts: ["Graph matching"],
            missingConcepts: ["Asymmetric credit calculation"],
          },
          facultyAwardedMarks: null,
          reviewStatus: "pending",
          referenceAwareEvaluation: {
            referenceAnalysis: { used: false },
          },
        },
      ],
    });

    console.log("✔ Created test AnswerSheet and Evaluation with AI marks (Q1: 8/10, Q2: 6/10).");

    // 3. Perform Faculty Review Actions
    console.log("\n--- Testing Faculty Actions ---");

    // Approve Q1 AI marks
    await acceptAiQuestion(testEval._id, 1, facultyUser._id);
    console.log("✔ Action 1: Accepted AI marks (8/10) for Q1.");

    // Override Q2 AI marks (modify from 6 to 9 with reason "AI underestimated answer")
    await overrideQuestion(
      testEval._id,
      2,
      9,
      "AI underestimated answer",
      "Student detailed conceptual step in paragraph 2.",
      facultyUser._id
    );
    console.log("✔ Action 2: Overridden AI marks (6 -> 9) for Q2.");

    // 4. Verify AI Evaluation Preservation & Override History
    const updatedEval = await Evaluation.findById(testEval._id);
    const q1 = updatedEval.questions.find((q) => String(q.questionNumber) === "1");
    const q2 = updatedEval.questions.find((q) => String(q.questionNumber) === "2");

    if (q1.aiEvaluation.marksAwarded !== 8 || q2.aiEvaluation.marksAwarded !== 6) {
      throw new Error("FAIL: Original AI marks were overwritten! Rule violated.");
    }
    console.log("✔ Verification 1: Original AI marks preserved intact (Q1 AI=8, Q2 AI=6).");

    if (q1.facultyEvaluation.status !== "approved" && q1.facultyEvaluation.status !== "APPROVED") {
      throw new Error("FAIL: Q1 facultyEvaluation status not set to approved.");
    }
    if (q2.facultyEvaluation.finalMarks !== 9 || q2.facultyEvaluation.overrideReason !== "AI underestimated answer") {
      throw new Error("FAIL: Q2 faculty override not recorded properly.");
    }
    console.log("✔ Verification 2: Faculty override finalMarks recorded separately (Q2 Final=9).");

    if (updatedEval.auditHistory.length < 2) {
      throw new Error("FAIL: Audit history entries missing.");
    }
    console.log(`✔ Verification 3: Audit history preserved (${updatedEval.auditHistory.length} log entries).`);

    // 5. Verify EvaluationFeedback Records & Normalized Metrics
    const feedbackRecords = await EvaluationFeedback.find({ evaluationId: testEval._id });
    if (feedbackRecords.length !== 2) {
      throw new Error(`FAIL: Expected 2 EvaluationFeedback records, got ${feedbackRecords.length}`);
    }

    const fbQ2 = feedbackRecords.find((f) => f.questionNumber === "2");
    if (!fbQ2) throw new Error("FAIL: Feedback record for Q2 not found.");

    if (fbQ2.difference !== 3) {
      throw new Error(`FAIL: Difference calculation incorrect. Expected 3, got ${fbQ2.difference}`);
    }
    if (fbQ2.normalizedAiMarks !== 0.6 || fbQ2.normalizedFacultyMarks !== 0.9 || fbQ2.normalizedDifference !== 0.3) {
      throw new Error("FAIL: Normalized metrics calculation mismatch.");
    }
    if (fbQ2.approvedForLearning !== false) {
      throw new Error("FAIL: New feedback record should default to approvedForLearning=false.");
    }
    console.log("✔ Verification 4: Structured EvaluationFeedback record created with normalized metrics & approvedForLearning=false.");

    // 6. Verify Calibration Analytics Engine
    console.log("\n--- Testing Calibration Analytics Engine ---");

    const summary = await calibrationService.getCalibrationSummary({}, facultyUser);
    if (!summary.hasData || summary.totalReviewed < 2) {
      throw new Error("FAIL: Calibration summary failed to aggregate review records.");
    }
    console.log(`✔ Calibration Summary: Total Reviewed=${summary.totalReviewed}, Approved=${summary.approvedCount}, Modified=${summary.modifiedCount}, Rate=${summary.modificationRate}%`);

    const qStats = await calibrationService.getQuestionLevelCalibration({}, facultyUser);
    if (!qStats.hasData || qStats.questions.length === 0) {
      throw new Error("FAIL: Question level calibration stats empty.");
    }
    console.log(`✔ Question-Level Calibration: Analyzed ${qStats.questions.length} questions.`);

    const confStats = await calibrationService.getConfidenceVsCorrection({}, facultyUser);
    console.log("✔ Confidence vs Correction Stats retrieved.");

    const refStats = await calibrationService.getReferenceEffectAnalysis({}, facultyUser);
    if (!refStats.hasData) {
      throw new Error("FAIL: Reference impact analysis failed.");
    }
    console.log(`✔ Reference Impact: Ref Used Modification Rate=${refStats.referenceUsed.modificationRate}%, Ref Not Used=${refStats.referenceNotUsed.modificationRate}%`);

    const insights = await calibrationService.getCalibrationInsights({}, facultyUser);
    if (!insights.hasData || insights.insights.length === 0) {
      throw new Error("FAIL: Calibration insights engine returned no results.");
    }
    console.log(`✔ Insights Engine: Generated ${insights.insights.length} insight(s). Sample: "${insights.insights[0]}"`);

    // 7. Test Controlled Learning Dataset Approval Workflow
    console.log("\n--- Testing Learning Dataset Approval Workflow ---");
    const updatedFb = await calibrationService.updateLearningApproval(fbQ2._id, true, facultyUser);
    if (updatedFb.approvedForLearning !== true) {
      throw new Error("FAIL: Failed to set approvedForLearning to true.");
    }
    console.log("✔ Approved record for learning dataset (approvedForLearning=true).");

    const approvedDs = await calibrationService.getLearningFeedbackDataset({ approvedForLearning: "true" }, facultyUser);
    if (approvedDs.total !== 1 || approvedDs.items[0]._id.toString() !== fbQ2._id.toString()) {
      throw new Error("FAIL: Learning dataset query with approvedForLearning=true mismatch.");
    }
    console.log("✔ Verified approved learning dataset filter.");

    // 8. Test Role Access Control
    console.log("\n--- Testing Security Boundaries ---");
    try {
      await calibrationService.updateLearningApproval(fbQ2._id, false, studentUser);
      throw new Error("FAIL: Student was allowed to modify learning dataset approval!");
    } catch (secErr) {
      if (secErr.statusCode === 403 || secErr.message.includes("authorized")) {
        console.log("✔ Security Check Passed: Student forbidden from modifying learning approval (403 Forbidden).");
      } else {
        throw secErr;
      }
    }

    console.log("\n=================================================");
    console.log("  ALL PHASE 7C VERIFICATION TESTS PASSED!        ");
    console.log("=================================================");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ PHASE 7C VERIFICATION SUITE FAILED:");
    console.error(err.errors || err);
    console.error(err.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runPhase7CVerificationSuite();
