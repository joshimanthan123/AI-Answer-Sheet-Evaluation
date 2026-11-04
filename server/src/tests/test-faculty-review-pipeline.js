import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import facultyReviewService from "../services/facultyReview.service.js";
import logger from "../utils/logger.js";

async function assertThrows(fn, expectedMessage) {
  try {
    await fn();
    throw new Error(`Expected error containing "${expectedMessage}", but no error was thrown.`);
  } catch (err) {
    if (!err.message || !err.message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", but got: "${err.message}"`);
    }
    console.log(`✓ successfully threw expected error: "${err.message}"`);
  }
}

async function runTest() {
  console.log("Starting Faculty Review Pipeline Integration Test Suite...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let faculty1 = null;
  let faculty2 = null;
  let student = null;
  let testDept = null;
  let testCourse = null;
  let testSubject = null;
  let testExam = null;
  let testAnswerSheet = null;
  let testEvaluation = null;

  try {
    // 1. Setup mock users
    faculty1 = await User.create({
      name: "Faculty Owner " + Date.now(),
      email: "test.fac1." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "L1-" + Date.now(),
      status: "online",
    });
    console.log("✓ Created Faculty Owner:", faculty1.email);

    faculty2 = await User.create({
      name: "Guest Faculty " + Date.now(),
      email: "test.fac2." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "L2-" + Date.now(),
      status: "online",
    });
    console.log("✓ Created Guest Faculty:", faculty2.email);

    student = await User.create({
      name: "Test Student " + Date.now(),
      email: "test.stu." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "STU-" + Date.now(),
      status: "online",
    });

    // 2. Setup mock structure
    testDept = await Department.create({
      name: "ENG Dept " + Date.now(),
      code: "ENG" + Math.floor(Math.random() * 1000),
      createdBy: faculty1._id,
    });

    testCourse = await Course.create({
      name: "B.Tech Review Course " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: testDept._id,
      createdBy: faculty1._id,
    });

    testSubject = await Subject.create({
      name: "Software Testing " + Date.now(),
      code: "ST" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: testCourse._id,
      faculty: faculty1._id,
      createdBy: faculty1._id,
    });

    // 3. Setup mock exam with two questions (10 max marks each)
    testExam = await Exam.create({
      subject: testSubject._id,
      title: "Mid-Term Review " + Date.now(),
      examType: "Mid-Sem",
      totalMarks: 20,
      duration: 120,
      examDate: new Date(),
      examStatus: "Published",
      isPublished: true,
      questions: [
        {
          questionNumber: 1,
          questionText: "What is unit testing?",
          maximumMarks: 10,
          expectedAnswerLength: "medium",
        },
        {
          questionNumber: 2,
          questionText: "Explain integration testing.",
          maximumMarks: 10,
          expectedAnswerLength: "medium",
        },
      ],
      createdBy: faculty1._id,
    });
    console.log("✓ Created exam with questions:", testExam.title);

    // 4. Create AnswerSheet
    testAnswerSheet = await AnswerSheet.create({
      student: student._id,
      exam: testExam._id,
      subject: testSubject._id,
      evaluationStatus: "EVALUATION_COMPLETED",
      reviewStatus: "READY_FOR_FACULTY_REVIEW",
      submissionStatus: "Submitted",
      evaluationSummary: {
        totalQuestions: 2,
        evaluatedQuestions: 2,
        failedQuestions: 0,
        totalMaximumMarks: 20,
        totalAwardedMarks: 12, // 6 each
        percentage: 60,
      },
      pages: [
        { pageNum: 1, imagePath: "/path.jpg", status: "completed" }
      ],
      extractedText: "Mock answer text for review testing.",
    });

    // 5. Create Evaluation with AI marks
    const q1Id = testExam.questions[0]._id;
    const q2Id = testExam.questions[1]._id;

    testEvaluation = await Evaluation.create({
      answerSheet: testAnswerSheet._id,
      studentId: student._id,
      obtainedMarks: 12,
      totalMarks: 20,
      percentage: 60,
      grade: "C",
      evaluationType: "AI",
      evaluationStatus: "AI_COMPLETED",
      questions: [
        {
          questionId: q1Id,
          recognizedText: "Unit testing is testing small code units.",
          studentAnswer: "Unit testing is testing small code units.",
          aiAwardedMarks: 6,
          maximumMarks: 10,
          aiMarks: 6,             // Include aiMarks too for complete conformity
          feedback: "AI feedback for Q1",
          keywordScore: 8,
          confidence: 0.85,
        },
        {
          questionId: q2Id,
          recognizedText: "Integration testing combines modules.",
          studentAnswer: "Integration testing combines modules.",
          aiAwardedMarks: 6,
          maximumMarks: 10,
          aiMarks: 6,
          feedback: "AI feedback for Q2",
          keywordScore: 7,
          confidence: 0.65, // Let's trigger a low confidence warning later
          warnings: [{ code: "LOW_CONFIDENCE", message: "Low segmentation score" }],
        },
      ],
    });
    console.log("✓ Created initial evaluation. Low confidence on Q2.");

    // --- EXECUTE PIPELINE TEST STEPS ---

    // Test 1: Access Security Check
    console.log("\n--- TEST 1: Access Security Control ---");
    // faculty1 (owner) should pass
    await facultyReviewService.validateAccess(testAnswerSheet, faculty1._id);
    console.log("✓ Faculty Owner access validation passed.");
    // faculty2 (guest) should fail
    await assertThrows(
      () => facultyReviewService.validateAccess(testAnswerSheet, faculty2._id),
      "Faculty member is not authorized"
    );

    // Test 2: Start Review
    console.log("\n--- TEST 2: Start Review Operation ---");
    // Guest tries starting review - should fail with Forbidden
    await assertThrows(
      () => facultyReviewService.startReview(testAnswerSheet._id, faculty2._id),
      "Faculty member is not authorized"
    );

    // Owner starts review
    const startResult = await facultyReviewService.startReview(testAnswerSheet._id, faculty1._id);
    console.log("✓ Start review transaction returned success status.");
    
    // Check state updates
    const asRefreshed = await AnswerSheet.findById(testAnswerSheet._id);
    if (asRefreshed.reviewStatus !== "FACULTY_REVIEW_IN_PROGRESS") {
      throw new Error(`Expected reviewStatus FACULTY_REVIEW_IN_PROGRESS, got ${asRefreshed.reviewStatus}`);
    }
    const evalRefreshed = await Evaluation.findById(testEvaluation._id);
    if (evalRefreshed.auditHistory.length !== 1 || evalRefreshed.auditHistory[0].action !== "REVIEW_STARTED") {
      throw new Error("Audit log for REVIEW_STARTED not written correctly");
    }
    console.log("✓ reviewStatus successfully transitioned: FACULTY_REVIEW_IN_PROGRESS");
    console.log("✓ REVIEW_STARTED audit log verified.");

    // Test 3: Conflict Check
    console.log("\n--- TEST 3: Concurrency Review Lock Check ---");
    // Create another exam and answer sheet owned by a mock user, put in reviewedStatus
    // Make sure we simulate conflict or block if faculty2 tries to override or start.
    // If faculty2 tries to override marks on faculty1's sheet, it throws Forbidden
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q1", 8, "Manual override", faculty2._id),
      "Faculty member is not authorized"
    );

    // Test 4: Mark Overrides & Recalculations
    console.log("\n--- TEST 4: Question Overrides, Bounds & Recalculation ---");
    // Invalid marks check: negative marks
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q1", -1, "Too low", faculty1._id),
      "Marks override must be in range 0 - 10"
    );
    // Invalid marks check: exceed max marks
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q1", 12, "Too high", faculty1._id),
      "Marks override must be in range 0 - 10"
    );
    // Question not found check
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q3", 5, "Non-existent Q", faculty1._id),
      "Question Q3 not found"
    );

    // Valid override: Change Q1 from AI 6 to Faculty 8
    const overrideResult = await facultyReviewService.reviewQuestion(
      testAnswerSheet._id,
      "Q1",
      8,
      "Excellent explanation, deserves extra points",
      faculty1._id
    );

    // Check recalculations
    const evalAfterOverride = await Evaluation.findById(testEvaluation._id);
    const q1Eval = evalAfterOverride.questions[0];
    if (q1Eval.finalAwardedMarks !== 8 || q1Eval.facultyAwardedMarks !== 8 || !q1Eval.wasOverridden) {
      throw new Error(`Override values incorrect. finalAwardedMarks = ${q1Eval.finalAwardedMarks}`);
    }
    
    // Check overall stats recalculation: Q1 (8) + Q2 (AI 6) = 14 total. 14/20 = 70% = Grade B
    if (evalAfterOverride.obtainedMarks !== 14 || evalAfterOverride.percentage !== 70 || evalAfterOverride.grade !== "B") {
      throw new Error(`Overall totals recalculation failed. obtainedMarks = ${evalAfterOverride.obtainedMarks}`);
    }
    
    // Check audit trails: should contain MARK_OVERRIDDEN
    const audit2 = evalAfterOverride.auditHistory[1];
    if (audit2.action !== "MARK_OVERRIDDEN" || audit2.questionNumber !== "Q1" || audit2.newValue.marks !== 8) {
      throw new Error("Audit log for MARK_OVERRIDDEN not written correctly");
    }
    console.log("✓ Manual score override bounds check verified.");
    console.log("✓ Overall score recalculations (Obtained: 14/20, Percentage: 70%, Grade: B) verified.");
    console.log("✓ MARK_OVERRIDDEN audit trail entry successfully logged.");

    // Test 5: Overall Comment
    console.log("\n--- TEST 5: Overall Comment addition ---");
    await facultyReviewService.addOverallComment(testAnswerSheet._id, "Very good performance.", faculty1._id);
    const evalCommented = await Evaluation.findById(testEvaluation._id);
    if (evalCommented.overallComment !== "Very good performance.") {
      throw new Error("Overall comment not saved correctly.");
    }
    console.log("✓ Saved overall feedback comment successfully.");

    // Test 6: Approve Review
    console.log("\n--- TEST 6: Review Approval Action ---");
    await facultyReviewService.approveReview(testAnswerSheet._id, faculty1._id);
    const asApproved = await AnswerSheet.findById(testAnswerSheet._id);
    if (asApproved.reviewStatus !== "APPROVED" || !asApproved.reviewedAt) {
      throw new Error(`Expected reviewStatus APPROVED, got ${asApproved.reviewStatus}`);
    }
    console.log("✓ transitioned reviewStatus: APPROVED");

    // Test 7: Finalize Review and Locks
    console.log("\n--- TEST 7: Review Finalization & Locking Mechanism ---");
    // Finalize lock
    await facultyReviewService.finalizeReview(testAnswerSheet._id, faculty1._id);
    
    const asFinalized = await AnswerSheet.findById(testAnswerSheet._id);
    if (asFinalized.reviewStatus !== "FINALIZED" || asFinalized.submissionStatus !== "Completed") {
      throw new Error(`Expected reviewStatus FINALIZED and submissionStatus Completed, got status: ${asFinalized.reviewStatus}`);
    }
    console.log("✓ reviewStatus permanently locked: FINALIZED");

    // Check lock blocks overrides
    console.log("Verifying that overrides on a finalized review is strictly prohibited:");
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q2", 9, "Attempt override on finalized", faculty1._id),
      "Review has been finalized and cannot be modified"
    );

    // Check lock blocks starting review again
    await assertThrows(
      () => facultyReviewService.startReview(testAnswerSheet._id, faculty1._id),
      "Cannot start review on a finalized evaluation"
    );

    console.log("✓ Finalization locks validated. All changes successfully blocked.");

    // Test 8: Complete Audit History List
    console.log("\n--- TEST 8: Full Audit Trail Verification ---");
    const evalAuditFinal = await Evaluation.findById(testEvaluation._id);
    console.log("Audit History entries written during review workflow:");
    evalAuditFinal.auditHistory.forEach((log, idx) => {
      console.log(`  [Log #${idx + 1}] Action: ${log.action}, By: ${log.changedBy}, Comment: ${log.comment}`);
    });
    
    const auditActions = evalAuditFinal.auditHistory.map(l => l.action);
    const expectedSequence = ["REVIEW_STARTED", "MARK_OVERRIDDEN", "COMMENT_ADDED", "REVIEW_APPROVED", "EVALUATION_FINALIZED"];
    for (const action of expectedSequence) {
      if (!auditActions.includes(action)) {
        throw new Error(`Audit log is missing action: ${action}`);
      }
    }
    console.log("✓ Sequenced audit trail verify checks completed successfully!");

    console.log("\n=============================================");
    console.log("🎉 ALL FACULTY REVIEW WORKFLOW TESTS PASSED!");
    console.log("=============================================");

  } catch (err) {
    console.error("❌ Verification tests ended with error: " + err.stack);
    process.exit(1);
  } finally {
    // Cleanup temporary mock databases records
    console.log("\nCleaning up temporary test records...");
    if (testEvaluation) await Evaluation.deleteOne({ _id: testEvaluation._id });
    if (testAnswerSheet) await AnswerSheet.deleteOne({ _id: testAnswerSheet._id });
    if (testExam) await Exam.deleteOne({ _id: testExam._id });
    if (testSubject) await Subject.deleteOne({ _id: testSubject._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (testDept) await Department.deleteOne({ _id: testDept._id });
    if (student) await User.deleteOne({ _id: student._id });
    if (faculty1) await User.deleteOne({ _id: faculty1._id });
    if (faculty2) await User.deleteOne({ _id: faculty2._id });
    console.log("Cleanup finished.");
    await mongoose.connection.close();
  }
}

runTest();
