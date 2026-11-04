import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import * as answerSheetService from "../services/answerSheet.service.js";
import * as studentExamService from "../services/studentExam.service.js";
import logger from "../utils/logger.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ai_evaluation_db";

async function runRegressionTests() {
  console.log("=== Starting OCR and Marks Persistence Regression Tests ===");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  let testDept, testCourse, testStudent, testFaculty, testSubject, testExam, testSheet, testEval;

  try {
    const timestamp = Date.now();

    testDept = await Department.create({
      name: `Regression Dept ${timestamp}`,
      code: `RD${timestamp % 10000}`,
      status: "active",
    });

    testStudent = await User.create({
      name: "Regression Student",
      email: `reg_student_${timestamp}@example.com`,
      password: "Password123!",
      role: "student",
      department: testDept.code,
      semester: 5,
      rollNo: `REG${timestamp % 10000}`,
    });

    testFaculty = await User.create({
      name: "Regression Faculty",
      email: `reg_faculty_${timestamp}@example.com`,
      password: "Password123!",
      role: "faculty",
      department: testDept.code,
    });

    testCourse = await Course.create({
      name: `Regression Course ${timestamp}`,
      code: `RC${timestamp % 10000}`,
      department: testDept._id,
      durationYears: 4,
      totalSemesters: 8,
      createdBy: testFaculty._id,
    });

    testSubject = await Subject.create({
      name: "Regression Test Subject",
      code: `CS${timestamp % 10000}`,
      department: testDept.code,
      semester: 5,
      credits: 4,
      course: testCourse._id,
      faculty: testFaculty._id,
      createdBy: testFaculty._id,
    });

    testExam = await Exam.create({
      title: "Regression Test Exam",
      subject: testSubject._id,
      examType: "MID_SEM",
      totalMarks: 50,
      duration: 60,
      isPublished: true,
      examDate: new Date(),
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      createdBy: testFaculty._id,
      questions: [
        {
          questionNumber: 1,
          questionText: "Explain neural network backpropagation.",
          maximumMarks: 25,
          marks: 25,
        },
        {
          questionNumber: 2,
          questionText: "What is gradient descent?",
          maximumMarks: 25,
          marks: 25,
        },
      ],
    });

    // Test 1: Start exam and idempotency on double-start
    console.log("\n--- Test 1: Start Exam Concurrency & Idempotency ---");
    const [startA, startB] = await Promise.all([
      studentExamService.startStudentExam(testStudent._id, testExam._id),
      studentExamService.startStudentExam(testStudent._id, testExam._id),
    ]);

    if (!startA.id || !startB.id) {
      throw new Error("Failed to start exam session");
    }
    console.log(`Start A ID: ${startA.id}, Start B ID: ${startB.id}`);
    const activeSheets = await AnswerSheet.find({
      student: testStudent._id,
      exam: testExam._id,
      isDeleted: false,
    });
    console.log(`Active sheets created: ${activeSheets.length} (expected 1)`);
    if (activeSheets.length !== 1) {
      throw new Error(`Expected exactly 1 active sheet, got ${activeSheets.length}`);
    }
    console.log("PASS: Start Exam concurrency test passed!");

    // Test 2: Add answers, submit, and verify evaluation persistence
    console.log("\n--- Test 2: Submit Exam and Evaluation Marks Mapping ---");
    testSheet = activeSheets[0];
    testSheet.submissionStatus = "Faculty Review";
    testSheet.processingStatus = "completed";
    testSheet.evaluationStatus = "READY_FOR_FACULTY_REVIEW";
    testSheet.evaluationSummary = {
      totalQuestions: 2,
      evaluatedQuestions: 2,
      failedQuestions: 0,
      totalMaximumMarks: 50,
      totalAwardedMarks: 42,
      percentage: 84,
    };
    testSheet.answers = [
      {
        questionId: testExam.questions[0]._id,
        recognizedText: "Backpropagation propagates the error gradient backward.",
        hwrStatus: "Completed",
        confidence: 0.95,
        aiAwardedMarks: 22,
        finalAwardedMarks: 22,
      },
      {
        questionId: testExam.questions[1]._id,
        recognizedText: "Gradient descent optimizes objective function.",
        hwrStatus: "Completed",
        confidence: 0.92,
        aiAwardedMarks: 20,
        finalAwardedMarks: 20,
      },
    ];
    testSheet.digital_answers = [
      {
        question_id: testExam.questions[0]._id,
        question_number: "1",
        question_text: "Explain neural network backpropagation.",
        max_marks: 25,
        text: "Backpropagation propagates the error gradient backward.",
        confidence: 0.95,
        strokes: [{ x: 10, y: 10 }],
      },
      {
        question_id: testExam.questions[1]._id,
        question_number: "2",
        question_text: "What is gradient descent?",
        max_marks: 25,
        text: "Gradient descent optimizes objective function.",
        confidence: 0.92,
        strokes: [{ x: 20, y: 20 }],
      },
    ];
    await testSheet.save();

    testEval = await Evaluation.create({
      answerSheet: testSheet._id,
      evaluationType: "AI",
      obtainedMarks: 42,
      totalMarks: 50,
      percentage: 84,
      grade: "A",
      evaluationStatus: "READY_FOR_FACULTY_REVIEW",
      evaluatedBy: testFaculty._id,
      createdBy: testFaculty._id,
      updatedBy: testFaculty._id,
    });

    // Test 3: Verify getAllAnswerSheets returns marks and evaluation fields
    console.log("\n--- Test 3: Verify getAllAnswerSheets Returns Marks ---");
    const studentList = await answerSheetService.getAllAnswerSheets(
      { exam: testExam._id.toString() },
      testStudent._id.toString(),
      "student"
    );

    const foundSheet = studentList.data.find(
      (s) => s._id.toString() === testSheet._id.toString()
    );
    if (!foundSheet) {
      throw new Error("AnswerSheet not found in student list");
    }

    console.log("Found Sheet in student list:");
    console.log(`  obtainedMarks: ${foundSheet.obtainedMarks}`);
    console.log(`  totalMarks: ${foundSheet.totalMarks}`);
    console.log(`  grade: ${foundSheet.grade}`);
    console.log(`  percentage: ${foundSheet.percentage}`);
    console.log(`  evaluationStatus: ${foundSheet.evaluation?.evaluationStatus}`);

    if (foundSheet.obtainedMarks !== 42 || foundSheet.totalMarks !== 50 || foundSheet.grade !== "A") {
      throw new Error(`Marks mapping mismatch: got ${foundSheet.obtainedMarks}/${foundSheet.totalMarks} (${foundSheet.grade})`);
    }
    console.log("PASS: getAllAnswerSheets correctly maps obtainedMarks, totalMarks, and grade!");

    // Test 4: Verify getAnswerSheetById returns digital_answers for faculty review
    console.log("\n--- Test 4: Verify Faculty Viewer digital_answers and Marks ---");
    const facultyView = await answerSheetService.getAnswerSheetById(
      testSheet._id.toString(),
      testFaculty._id.toString(),
      "faculty"
    );

    if (!facultyView.digital_answers || facultyView.digital_answers.length !== 2) {
      throw new Error(`Expected 2 digital_answers, got ${facultyView.digital_answers?.length}`);
    }
    if (facultyView.obtainedMarks !== 42 || facultyView.totalMarks !== 50) {
      throw new Error(`Faculty view marks mismatch: got ${facultyView.obtainedMarks}/${facultyView.totalMarks}`);
    }
    console.log("PASS: Faculty viewer retrieves digital_answers and marks correctly!");

    // Test 5: Verify unsubmitted empty draft filtering
    console.log("\n--- Test 5: Verify Unsubmitted Empty Draft Filtering ---");
    const abandonedDraft = await AnswerSheet.create({
      student: testStudent._id,
      subject: testSubject._id,
      exam: testExam._id,
      submissionStatus: "Started",
      submissionType: "DIGITAL",
      processingStatus: "uploaded",
      answers: [],
      createdBy: testStudent._id,
    });

    const refreshedList = await answerSheetService.getAllAnswerSheets(
      { exam: testExam._id.toString() },
      testStudent._id.toString(),
      "student"
    );

    const draftFound = refreshedList.data.some(
      (s) => s._id.toString() === abandonedDraft._id.toString()
    );
    if (draftFound) {
      throw new Error("Abandoned empty draft should have been filtered out of student list!");
    }
    console.log("PASS: Abandoned empty draft was correctly filtered out!");

    // Clean up abandoned draft
    await AnswerSheet.findByIdAndDelete(abandonedDraft._id);

    console.log("\n=== ALL REGRESSION TESTS PASSED! ===");
  } finally {
    // Cleanup test records
    console.log("\nCleaning up regression test data...");
    if (testEval) await Evaluation.findByIdAndDelete(testEval._id);
    if (testSheet) await AnswerSheet.findByIdAndDelete(testSheet._id);
    if (testExam) await Exam.findByIdAndDelete(testExam._id);
    if (testSubject) await Subject.findByIdAndDelete(testSubject._id);
    if (testCourse) await Course.findByIdAndDelete(testCourse._id);
    if (testDept) await Department.findByIdAndDelete(testDept._id);
    if (testStudent) await User.findByIdAndDelete(testStudent._id);
    if (testFaculty) await User.findByIdAndDelete(testFaculty._id);
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runRegressionTests().catch((err) => {
  console.error("Regression test suite failed:", err);
  process.exit(1);
});
