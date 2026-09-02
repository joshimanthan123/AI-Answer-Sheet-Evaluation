import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import * as resultPublicationService from "../services/resultPublication.service.js";
import * as studentResultService from "../services/studentResult.service.js";
import facultyReviewService from "../services/facultyReview.service.js";

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
  console.log("Starting Result Publication Pipeline Integration Test Suite...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let faculty1 = null;
  let Student1 = null;
  let Student2 = null;
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
      email: "test.publication.fac1." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "L1-" + Date.now(),
      status: "online"
    });
    console.log("✓ Created Faculty Owner:", faculty1.email);

    Student1 = await User.create({
      name: "Student One " + Date.now(),
      email: "test.publication.stu1." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "STU1-" + Date.now(),
      status: "online"
    });
    console.log("✓ Created Student One:", Student1.email);

    Student2 = await User.create({
      name: "Student Two " + Date.now(),
      email: "test.publication.stu2." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "STU2-" + Date.now(),
      status: "online"
    });
    console.log("✓ Created Student Two:", Student2.email);

    // 2. Setup courses/subjects structure
    testDept = await Department.create({
      name: "Publication Dept " + Date.now(),
      code: "PUB" + Math.floor(Math.random() * 1000),
      createdBy: faculty1._id
    });

    testCourse = await Course.create({
      name: "B.Tech Publication Course " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: testDept._id,
      createdBy: faculty1._id
    });

    testSubject = await Subject.create({
      name: "Network Security " + Date.now(),
      code: "NS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: testCourse._id,
      faculty: faculty1._id,
      createdBy: faculty1._id
    });

    // 3. Setup mock exam with questions
    testExam = await Exam.create({
      subject: testSubject._id,
      title: "Mid-Term Security " + Date.now(),
      examType: "Mid-Sem",
      totalMarks: 20,
      passingMarks: 8,
      duration: 120,
      examDate: new Date(),
      examStatus: "Published",
      isPublished: true,
      questions: [
        {
          questionNumber: 1,
          questionText: "What is encryption?",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        },
        {
          questionNumber: 2,
          questionText: "Explain Symmetric Cryptography.",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        }
      ],
      createdBy: faculty1._id
    });
    console.log("✓ Created Exam:", testExam.title);

    // 4. Create AnswerSheet for Student One
    testAnswerSheet = await AnswerSheet.create({
      student: Student1._id,
      exam: testExam._id,
      subject: testSubject._id,
      evaluationStatus: "EVALUATION_COMPLETED",
      reviewStatus: "FINALIZED",
      submissionStatus: "Completed",
      evaluationSummary: {
        totalQuestions: 2,
        evaluatedQuestions: 2,
        failedQuestions: 0,
        totalMaximumMarks: 20,
        totalAwardedMarks: 15,
        percentage: 75
      },
      resultPublication: {
        status: "READY_FOR_RESULT_PUBLICATION"
      },
      pages: [
        { pageNum: 1, imagePath: "/page1.jpg", status: "completed" }
      ],
      extractedText: "Encryption translates data to ciphertext."
    });

    // 5. Create core Evaluation
    const q1Id = testExam.questions[0]._id;
    const q2Id = testExam.questions[1]._id;

    testEvaluation = await Evaluation.create({
      answerSheet: testAnswerSheet._id,
      studentId: Student1._id,
      obtainedMarks: 15,
      totalMarks: 20,
      percentage: 75,
      grade: "A",
      evaluationType: "AI",
      evaluationStatus: "finalized",
      questions: [
        {
          questionId: q1Id,
          recognizedText: "Encryption translates data to ciphertext.",
          studentAnswer: "Encryption translates data to ciphertext.",
          aiAwardedMarks: 6,
          facultyAwardedMarks: 8, // Overridden value is 8
          finalAwardedMarks: 8,
          maximumMarks: 10,
          aiMarks: 6,
          feedback: "Good explanation of ciphertext.",
          confidence: 0.9,
          wasOverridden: true,
          facultyComment: "Adding points for terminology."
        },
        {
          questionId: q2Id,
          recognizedText: "Symmetric uses same key.",
          studentAnswer: "Symmetric uses same key.",
          aiAwardedMarks: 7,
          finalAwardedMarks: 7,
          maximumMarks: 10,
          aiMarks: 7,
          feedback: "Correct basic understanding.",
          confidence: 0.8
        }
      ]
    });
    console.log("✓ Hydrated answer sheet and evaluation records.");

    // --- PIPELINE TESTS ---

    // TEST 1: Student Isolation & Visibility before Publication
    console.log("\n--- TEST 1: Access Isolation before Publication ---");
    // Student 1 requests own result before publication - should throw 404 (RESULT_NOT_AVAILABLE)
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, Student1._id),
      "RESULT_NOT_AVAILABLE"
    );

    // Student 2 requests Student 1's result - should throw 404
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, Student2._id),
      "RESULT_NOT_AVAILABLE"
    );
    console.log("✓ Verified unpublished results are completely hidden (404 forced).");

    // TEST 2: Result Publication Transition
    console.log("\n--- TEST 2: Result Publication Operation ---");
    const pubResult = await resultPublicationService.publishResult(
      testAnswerSheet._id,
      faculty1._id,
      "Official mid-term results released."
    );

    // Verify DB states: review status mapping and resultPublication sub-document
    const sheetPublished = await AnswerSheet.findById(testAnswerSheet._id);
    if (sheetPublished.reviewStatus !== "FINALIZED") {
      throw new Error(`Expected reviewStatus FINALIZED, got ${sheetPublished.reviewStatus}`);
    }
    if (sheetPublished.resultPublication.status !== "RESULT_PUBLISHED") {
      throw new Error(`Expected publication status RESULT_PUBLISHED, got ${sheetPublished.resultPublication.status}`);
    }
    if (sheetPublished.resultPublication.publicationComment !== "Official mid-term results released.") {
      throw new Error("Publication comment was not saved correctly.");
    }
    if (!sheetPublished.resultPublication.publishedAt) {
      throw new Error("Publication timestamp (publishedAt) is missing.");
    }

    // Verify audit history trail log entry
    const evalPublished = await Evaluation.findById(testEvaluation._id);
    const lastAudit = evalPublished.auditHistory[evalPublished.auditHistory.length - 1];
    if (lastAudit.action !== "RESULT_PUBLISHED") {
      throw new Error(`Expected last audit action RESULT_PUBLISHED, got ${lastAudit.action}`);
    }
    console.log("✓ Result publication state successfully transitioned.");
    console.log("✓ Schema timestamps and audit log verification passed.");

    // TEST 3: Student View Access & Data Integrity
    console.log("\n--- TEST 3: Student Visibility & Data Integrity checks ---");
    // Student 1 fetches published details - should succeed now!
    const studentReport = await studentResultService.getStudentResultDetails(testAnswerSheet._id, Student1._id);
    console.log("✓ Student 1 successfully fetched published detailed report.");

    // Verify only faculty finalAwardedMarks are shown, not raw AI marks
    const q1Report = studentReport.questions.find(q => q.questionId.toString() === q1Id.toString());
    if (!q1Report) throw new Error("Question 1 is missing from student report.");
    if (q1Report.score !== 8) {
      throw new Error(`Security Violation: Expected faculty final marks of 8, but student saw score: ${q1Report.score}`);
    }
    // Verify comments/feedback presence
    if (q1Report.feedback !== "Adding points for terminology.") {
      throw new Error("Student report did not receive faculty override comments.");
    }

    // Student 2 tries to access Student 1's published result - must return 404 (Access Isolation)
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, Student2._id),
      "RESULT_NOT_AVAILABLE"
    );
    console.log("✓ Data integrity: Student can only view final faculty marks, AI values hidden.");
    console.log("✓ Access isolation: Students are barred from accessing other students' results.");

    // TEST 4: Integrity Grade Locks
    console.log("\n--- TEST 4: Grade Override Locks, modifications barred ---");
    // Verify modifying question score on direct review service fails
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "Q1", 9, "Attempt override after publication", faculty1._id),
      "Review has been finalized and cannot be modified"
    );
    console.log("✓ Verified that grade changes are forbidden on locked published results.");

    // TEST 5: Unpublish Results
    console.log("\n--- TEST 5: Unpublish Results & Rollback Isolation ---");
    // Faculty unpublishes sheet
    const unpubResult = await resultPublicationService.unpublishResult(
      testAnswerSheet._id,
      faculty1._id,
      "Revoking scores for further revisions."
    );

    // Verify DB states: review status mapping and resultPublication sub-document
    const sheetUnpublished = await AnswerSheet.findById(testAnswerSheet._id);
    if (sheetUnpublished.reviewStatus !== "FINALIZED") {
      throw new Error(`Expected reviewStatus FINALIZED, got ${sheetUnpublished.reviewStatus}`);
    }
    if (sheetUnpublished.resultPublication.status !== "RESULT_UNPUBLISHED") {
      throw new Error(`Expected publication status RESULT_UNPUBLISHED, got ${sheetUnpublished.resultPublication.status}`);
    }
    if (!sheetUnpublished.resultPublication.unpublishedAt) {
      throw new Error("Unpublication timestamp (unpublishedAt) is missing.");
    }

    // Verify audit log has RESULT_UNPUBLISHED
    const evalUnpublished = await Evaluation.findById(testEvaluation._id);
    const lastAuditUnpub = evalUnpublished.auditHistory[evalUnpublished.auditHistory.length - 1];
    if (lastAuditUnpub.action !== "RESULT_UNPUBLISHED") {
      throw new Error(`Expected last audit action RESULT_UNPUBLISHED, got ${lastAuditUnpub.action}`);
    }

    // Student 1 requests result again - must return 404 (hidden)
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, Student1._id),
      "RESULT_NOT_AVAILABLE"
    );
    console.log("✓ Unpublish transitioned state successfully.");
    console.log("✓ Student access revoked immediately; returns 404.");

    console.log("\n=======================================================");
    console.log("🎉 ALL RESULTS PUBLICATION PIPELINE TESTS PASSED!");
    console.log("=======================================================");

  } catch (err) {
    console.error("❌ Verification tests ended with error: " + err.stack);
    process.exit(1);
  } finally {
    // Cleanup records
    console.log("\nCleaning up temporary test records...");
    if (testEvaluation) await Evaluation.deleteOne({ _id: testEvaluation._id });
    if (testAnswerSheet) await AnswerSheet.deleteOne({ _id: testAnswerSheet._id });
    if (testExam) await Exam.deleteOne({ _id: testExam._id });
    if (testSubject) await Subject.deleteOne({ _id: testSubject._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (testDept) await Department.deleteOne({ _id: testDept._id });
    if (Student1) await User.deleteOne({ _id: Student1._id });
    if (Student2) await User.deleteOne({ _id: Student2._id });
    if (faculty1) await User.deleteOne({ _id: faculty1._id });
    console.log("Cleanup finished.");
    await mongoose.connection.close();
  }
}

runTest();
