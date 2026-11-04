import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerKey from "../models/AnswerKey.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
import facultyReviewService from "../services/facultyReview.service.js";
import * as resultPublicationService from "../services/resultPublication.service.js";
import * as studentResultService from "../services/studentResult.service.js";

async function assertThrows(fn, expectedMessage) {
  try {
    await fn();
    throw new Error(`Expected error containing "${expectedMessage}", but no error was thrown.`);
  } catch (err) {
    if (!err.message || !err.message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", but got: "${err.message}"`);
    }
  }
}

async function runTest() {
  console.log("Starting Complete System Integration Test Suite...");
  await mongoose.connect(env.MONGODB_URI);

  let faculty = null;
  let unauthorizedFaculty = null;
  let student = null;
  let otherStudent = null;
  let testDept = null;
  let testCourse = null;
  let testSubject = null;
  let testExam = null;
  let testAnswerKey = null;
  let testAnswerSheet = null;
  let testEvaluation = null;

  try {
    // 1. Create Faculty
    faculty = await User.create({
      name: "Faculty Owner " + Date.now(),
      email: "fac.integ." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC-" + Date.now(),
      status: "online"
    });
    console.log("✓ Faculty created");

    unauthorizedFaculty = await User.create({
      name: "Unauthorized Faculty " + Date.now(),
      email: "fac.unauth." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC-UNAUTH-" + Date.now(),
      status: "online"
    });

    // 2. Create Student
    student = await User.create({
      name: "Student Candidate " + Date.now(),
      email: "stu.integ." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "ROLL-" + Date.now(),
      status: "online"
    });
    console.log("✓ Student created");

    otherStudent = await User.create({
      name: "Spy Student " + Date.now(),
      email: "stu.spy." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "ROLL-SPY-" + Date.now(),
      status: "online"
    });

    // 3. Create Course
    testDept = await Department.create({
      name: "Integ Dept " + Date.now(),
      code: "INT" + Math.floor(Math.random() * 1000),
      createdBy: faculty._id
    });

    testCourse = await Course.create({
      name: "B.Tech Integration Course " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: testDept._id,
      createdBy: faculty._id
    });

    testSubject = await Subject.create({
      name: "Database Systems " + Date.now(),
      code: "DBS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 3,
      isActive: true,
      course: testCourse._id,
      faculty: faculty._id,
      createdBy: faculty._id
    });

    // 4. Create Exam
    testExam = await Exam.create({
      subject: testSubject._id,
      title: "Mid-Term DBMS " + Date.now(),
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
          questionText: "Explain ACID Properties.",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        },
        {
          questionNumber: 2,
          questionText: "What is 3NF?",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        }
      ],
      createdBy: faculty._id
    });
    console.log("✓ Exam configured");
    console.log("✓ Student authorized");

    // Create approved AnswerKey
    testAnswerKey = await AnswerKey.create({
      examId: testExam._id,
      isActive: true,
      uploadStatus: "Approved",
      parsedAnswers: [
        {
          questionNumber: 1,
          questionId: testExam.questions[0]._id,
          answerText: "ACID stands for Atomicity, Consistency, Isolation, and Durability.",
          keywords: ["atomicity", "consistency", "isolation", "durability"]
        },
        {
          questionNumber: 2,
          questionId: testExam.questions[1]._id,
          answerText: "Third Normal Form ensures no transitive functional dependencies.",
          keywords: ["dependency", "transitive"]
        }
      ],
      uploadedBy: faculty._id,
      fileName: "dbms-key.pdf",
      fileUrl: "http://localhost:5000/uploads/dbms-key.pdf",
      createdBy: faculty._id,
      updatedBy: faculty._id
    });

    // 5. Create Answer Sheet (Submitted stage)
    testAnswerSheet = await AnswerSheet.create({
      student: student._id,
      exam: testExam._id,
      subject: testSubject._id,
      evaluationStatus: "READY_FOR_EVALUATION",
      reviewStatus: "NOT_READY",
      submissionStatus: "Submitted",
      pages: [
        { pageNum: 1, imagePath: "/path.jpg", status: "completed" }
      ],
      extractedText: "ACID properties: Atomicity, Consistency, Isolation, and Durability. 3NF: No transitive dependency.",
      resultPublication: {
        status: "NOT_READY"
      }
    });
    console.log("✓ Answer sheet submitted");

    // 6. Complete OCR processing
    testAnswerSheet.ocrStatus = "completed";
    testAnswerSheet.processingStatus = "completed";
    testAnswerSheet.answers = [
      {
        questionId: testExam.questions[0]._id,
        recognizedText: "ACID: Atomicity, Consistency, Isolation, and Durability details.",
        confidence: 0.95
      },
      {
        questionId: testExam.questions[1]._id,
        recognizedText: "3NF normalizes tables without dependency.",
        confidence: 0.85
      }
    ];
    await testAnswerSheet.save();
    console.log("✓ OCR completed");

    // 7. Queue AI evaluation
    const ev = await evaluationPipelineService.queueEvaluation(testAnswerSheet._id, faculty._id);
    testEvaluation = ev;

    // 8. Wait for AI evaluation background task to complete via polling
    const activeStates = ["QUEUED_FOR_EVALUATION", "LOADING_ANSWER_KEY", "BUILDING_PROMPT", "AI_EVALUATING", "VALIDATING_RESULT"];
    let sheet = await AnswerSheet.findById(testAnswerSheet._id);
    let attempts = 0;
    while (activeStates.includes(sheet.evaluationStatus) && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      sheet = await AnswerSheet.findById(testAnswerSheet._id);
      attempts++;
    }
    
    if (sheet.evaluationStatus === "EVALUATION_FAILED") {
      throw new Error(`AI Evaluation crashed: ${sheet.evaluationError}`);
    }
    console.log("✓ AI evaluation completed");

    // 9. Faculty starts review
    // Unauthorized faculty should be blocked
    await assertThrows(
      () => facultyReviewService.startReview(testAnswerSheet._id, unauthorizedFaculty._id),
      "not authorized"
    );
    await facultyReviewService.startReview(testAnswerSheet._id, faculty._id);

    // 10. Override at least one question (Q1: from AI marks to 8)
    await facultyReviewService.reviewQuestion(testAnswerSheet._id, "1", 8, "Great concise presentation", faculty._id);

    // 11. Add comment & Approve review
    await facultyReviewService.addOverallComment(testAnswerSheet._id, "Solid work on databases.", faculty._id);
    await facultyReviewService.approveReview(testAnswerSheet._id, faculty._id);

    // 12. Finalize evaluation
    await facultyReviewService.finalizeReview(testAnswerSheet._id, faculty._id);
    console.log("✓ Faculty review completed");
    console.log("✓ Evaluation finalized");

    // 13. Publish result
    // Lock check: Verify direct overrides are now barred
    await assertThrows(
      () => facultyReviewService.reviewQuestion(testAnswerSheet._id, "1", 9, "Attempt override on finalized", faculty._id),
      "finalized and cannot be modified"
    );
    
    await resultPublicationService.publishResult(testAnswerSheet._id, faculty._id, "DBMS term results published.");
    console.log("✓ Result published");

    // 14. Student retrieves result list & details
    const listRes = await studentResultService.getStudentResults(student._id);
    if (listRes.data.length !== 1) {
      throw new Error("Published answer sheet list fetch failed.");
    }
    const report = await studentResultService.getStudentResultDetails(testAnswerSheet._id, student._id);
    console.log("✓ Student result accessible");

    // 15. Verify final marks & AI marks hidden
    const q1Report = report.questions.find(q => q.questionNumber === 1);
    if (!q1Report || q1Report.score !== 8) {
      throw new Error("Final marks verify check failed.");
    }
    console.log("✓ Final marks verified");
    console.log("✓ AI marks are hidden");

    // 16. Attempt unauthorized access
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, otherStudent._id),
      "RESULT_NOT_AVAILABLE"
    );
    console.log("✓ Unauthorized access blocked");

    // 17. Unpublish result
    await resultPublicationService.unpublishResult(testAnswerSheet._id, faculty._id, "Withdrawn for audit check");
    console.log("✓ Result unpublished");

    // 18. Verify student access is removed (returns 404)
    await assertThrows(
      () => studentResultService.getStudentResultDetails(testAnswerSheet._id, student._id),
      "RESULT_NOT_AVAILABLE"
    );
    console.log("✓ Student access revoked");

    console.log("\n🎉 COMPLETE SYSTEM INTEGRATION TEST PASSED");

  } catch (err) {
    console.error("❌ Component Integration failed with error: " + err.stack);
    process.exit(1);
  } finally {
    // Cleanup temporary mock databases records
    if (testEvaluation) await Evaluation.deleteOne({ _id: testEvaluation._id });
    if (testAnswerSheet) await AnswerSheet.deleteOne({ _id: testAnswerSheet._id });
    if (testAnswerKey) await AnswerKey.deleteOne({ _id: testAnswerKey._id });
    if (testExam) await Exam.deleteOne({ _id: testExam._id });
    if (testSubject) await Subject.deleteOne({ _id: testSubject._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (testDept) await Department.deleteOne({ _id: testDept._id });
    if (student) await User.deleteOne({ _id: student._id });
    if (otherStudent) await User.deleteOne({ _id: otherStudent._id });
    if (faculty) await User.deleteOne({ _id: faculty._id });
    if (unauthorizedFaculty) await User.deleteOne({ _id: unauthorizedFaculty._id });
    await mongoose.connection.close();
  }
}

runTest();
