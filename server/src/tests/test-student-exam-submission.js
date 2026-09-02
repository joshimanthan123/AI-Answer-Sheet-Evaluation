import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import studentExamService from "../services/studentExam.service.js";
import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
// Mock global.fetch for FastAPI OCR recognize-strokes call for deterministic fast execution
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  if (typeof url === "string" && url.includes("recognize-strokes")) {
    return {
      ok: true,
      json: async () => ({ status: "success", text: "Recognized sample text", confidence: 0.95 }),
    };
  }
  if (originalFetch) return originalFetch(url, options);
  return { ok: true, json: async () => ({}) };
};

// Mock the queueEvaluation method to track calls and control success/failure
let queueEvaluationCalls = [];
let mockQueueShouldFail = false;

const originalQueueEvaluation = evaluationPipelineService.queueEvaluation;
evaluationPipelineService.queueEvaluation = async (answerSheetId, userId) => {
  queueEvaluationCalls.push({ answerSheetId: answerSheetId.toString(), userId: userId.toString() });
  if (mockQueueShouldFail) {
    throw new Error("Simulated Background Queue Failure");
  }
  // Return mock evaluation object
  return {
    _id: new mongoose.Types.ObjectId(),
    evaluationStatus: "pending",
  };
};

async function runTests() {
  console.log("Starting Student Exam Submission Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let facultyUser = null;
  let studentUser = null;
  let unauthorizedStudent = null;
  
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;

  let upcomingExam = null;
  let activeExam = null;
  let expiredExam = null;
  let activeExam2 = null;
  let activeExam3 = null;

  try {
    // 1. Setup Users
    facultyUser = await User.create({
      name: "Sub Faculty",
      email: "sub.faculty@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LECSUB" + Date.now(),
    });

    // 2. Setup Department / Course / Subject
    tempDept = await Department.create({
      name: "CE Department " + Date.now(),
      code: "CE" + Date.now(),
      createdBy: facultyUser._id,
    });

    studentUser = await User.create({
      name: "Sub Student",
      email: "sub.student@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDSUB" + Date.now(),
      semester: 5,
      department: tempDept.code,
    });

    unauthorizedStudent = await User.create({
      name: "Sub Unauth Student",
      email: "sub.unauth@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDUNAUTHSUB" + Date.now(),
      semester: 1,
      department: "EC",
    });

    tempCourse = await Course.create({
      name: "BE CE " + Date.now(),
      code: "BECE" + Date.now(),
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: facultyUser._id,
    });

    tempSubject = await Subject.create({
      name: "Software Architecture " + Date.now(),
      code: "CS502" + Date.now(),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });

    const now = new Date();

    // 3. Setup Exams
    const activeStart = new Date(now.getTime() - 15 * 60 * 1000);
    const activeEnd = new Date(now.getTime() + 45 * 60 * 1000);
    activeExam = await Exam.create({
      title: "Active Architecture Exam",
      examCode: "CS502-ACT",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [
        { questionNumber: 1, questionText: "Define Architecture Pattern.", maximumMarks: 35 },
      ],
    });

    const upcomingStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const upcomingEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    upcomingExam = await Exam.create({
      title: "Upcoming Architecture Exam",
      examCode: "CS502-UPC",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: upcomingStart,
      startTime: upcomingStart,
      endTime: upcomingEnd,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [
        { questionNumber: 1, questionText: "Define Microservices.", maximumMarks: 70 },
      ],
    });

    const expiredStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const expiredEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expiredExam = await Exam.create({
      title: "Expired Architecture Exam",
      examCode: "CS502-EXP",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: expiredStart,
      startTime: expiredStart,
      endTime: expiredEnd,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [
        { questionNumber: 1, questionText: "Define Monolith.", maximumMarks: 70 },
      ],
    });

    // Reset calls list
    queueEvaluationCalls = [];

    // --- EXECUTION OF SCENARIOS ---

    // Scenario 1: Successful submission of an active draft
    console.log("\n--- Scenario 1: Successful Submission ---");
    // Start active exam to initialize a draft sheet
    const startResult = await studentExamService.startStudentExam(studentUser._id, activeExam._id);
    console.log("Exam started with submission ID: " + startResult.id);

    // Save one answer
    await studentExamService.autosaveStudentExamAnswer(studentUser._id, activeExam._id, {
      questionId: activeExam.questions[0]._id,
      handwrittenData: "User written strokes data sample contents",
    });

    // Call submit
    const submitResult = await studentExamService.submitStudentExam(studentUser._id, activeExam._id);
    console.log("Submision completed: ", submitResult);
    
    // Assertions
    const sheet = await AnswerSheet.findById(submitResult.submissionId);
    if (!sheet) throw new Error("AnswerSheet not found");
    if (sheet.submissionStatus !== "Submitted") throw new Error("Expected Submitted state, got: " + sheet.submissionStatus);
    if (!["processing", "completed", "ready_for_evaluation"].includes(sheet.processingStatus)) throw new Error("Expected processing or completed, got: " + sheet.processingStatus);
    if (!sheet.submittedAt) throw new Error("Expected submittedAt to be populated");
    
    // Allow background processDigitalExamHWRBackground worker to run
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Assert queueEvaluation was triggered
    if (queueEvaluationCalls.length !== 1 || queueEvaluationCalls[0].answerSheetId !== sheet._id.toString()) {
      throw new Error("Evaluation pipeline was not queued for answer sheet");
    }
    console.log("Scenario 1 Passed!");

    // Scenario 2: Idempotency checks. Successive submit requests do not error and return same status
    console.log("\n--- Scenario 2: Submission Idempotency ---");
    // Submit same exam again
    const secondSubmitResult = await studentExamService.submitStudentExam(studentUser._id, activeExam._id);
    console.log("Second submission result: ", secondSubmitResult);
    if (!secondSubmitResult.alreadySubmitted) throw new Error("Expected alreadySubmitted: true");
    if (secondSubmitResult.submissionStatus !== "Submitted") throw new Error("Expected Submitted status");
    // Assert it did not trigger another queue evaluation call (should remain count = 1)
    if (queueEvaluationCalls.length !== 1) {
      throw new Error("Expected queueEvaluation to not be called again");
    }
    console.log("Scenario 2 Passed!");

    // Scenario 3: Upcoming exam submission limits
    console.log("\n--- Scenario 3: Upcoming Exam block ---");
    try {
      await studentExamService.submitStudentExam(studentUser._id, upcomingExam._id);
      throw new Error("Expected upcoming submission to fail");
    } catch (err) {
      if (err.statusCode !== 404 && err.statusCode !== 403 && err.message !== "No active exam session found. Start the exam first.") {
        throw err;
      }
      console.log("Expected exception caught successfully: " + err.message);
    }
    console.log("Scenario 3 Passed!");

    // Scenario 4: Expired exam submission limits
    console.log("\n--- Scenario 4: Expired Exam block ---");
    // Create pre-existing draft for expired exam
    const expiredSheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: expiredExam._id,
      submissionStatus: "Started",
      submissionType: "DIGITAL",
      createdBy: studentUser._id,
    });
    try {
      await studentExamService.submitStudentExam(studentUser._id, expiredExam._id);
      throw new Error("Expected expired exam submission to fail with forbidden duration alert");
    } catch (err) {
      if (err.statusCode !== 403 || !err.message.includes("expired")) {
        throw err;
      }
      console.log("Expected exception caught successfully: " + err.message);
    }
    console.log("Scenario 4 Passed!");

    // Scenario 5: Ineligible student block
    console.log("\n--- Scenario 5: Ineligible Student block ---");
    try {
      await studentExamService.submitStudentExam(unauthorizedStudent._id, activeExam._id);
      throw new Error("Expected ineligible student submission to fail");
    } catch (err) {
      if (err.statusCode !== 403 || !err.message.includes("eligible")) {
        throw err;
      }
      console.log("Expected exception caught successfully: " + err.message);
    }
    console.log("Scenario 5 Passed!");

    // Scenario 6: Editing after submission rejected
    console.log("\n--- Scenario 6: Edit after submission rejected ---");
    try {
      await studentExamService.autosaveStudentExamAnswer(studentUser._id, activeExam._id, {
        questionId: activeExam.questions[0]._id,
        handwrittenData: "new strokes after submission attempt block",
      });
      throw new Error("Expected editing after submission to fail");
    } catch (err) {
      if (err.statusCode !== 403 || !err.message.includes("locked")) {
        throw err;
      }
      console.log("Expected exception caught successfully: " + err.message);
    }
    console.log("Scenario 6 Passed!");

    // Scenario 7: Processing queue failure handling (fails pipeline, sheet stays locked)
    console.log("\n--- Scenario 7: Queue failure handling ---");
    // Setup another exam and mock failure
    const exam2Start = new Date(now.getTime() - 10 * 60 * 1000);
    const exam2End = new Date(now.getTime() + 50 * 60 * 1000);
    activeExam2 = await Exam.create({
      title: "Active Exam 2",
      examCode: "CS502-ACT2",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: exam2Start,
      startTime: exam2Start,
      endTime: exam2End,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [
        { questionNumber: 1, questionText: "Question test text", maximumMarks: 70 },
      ],
    });

    await studentExamService.startStudentExam(studentUser._id, activeExam2._id);
    
    mockQueueShouldFail = true;
    const submitResult2 = await studentExamService.submitStudentExam(studentUser._id, activeExam2._id);
    console.log("Submission result despite queue failure: ", submitResult2);
    
    // Validate sheet remains locked as Submitted
    const lockedSheet2 = await AnswerSheet.findById(submitResult2.submissionId);
    if (!lockedSheet2 || lockedSheet2.submissionStatus !== "Submitted") {
      throw new Error("Expected AnswerSheet to save as Submitted despite queue failure");
    }
    console.log("Scenario 7 Passed!");

    // Reset queue mocks
    mockQueueShouldFail = false;
    queueEvaluationCalls = [];

    // Scenario 8: Parallel / concurrent submission calls test
    console.log("\n--- Scenario 8: Parallel Submission calls ---");
    const exam3Start = new Date(now.getTime() - 10 * 60 * 1000);
    const exam3End = new Date(now.getTime() + 50 * 60 * 1000);
    activeExam3 = await Exam.create({
      title: "Active Exam 3",
      examCode: "CS502-ACT3",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: exam3Start,
      startTime: exam3Start,
      endTime: exam3End,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Parallel test", maximumMarks: 70 }],
    });

    await studentExamService.startStudentExam(studentUser._id, activeExam3._id);

    // Call submit concurrent
    const results = await Promise.all([
      studentExamService.submitStudentExam(studentUser._id, activeExam3._id),
      studentExamService.submitStudentExam(studentUser._id, activeExam3._id)
    ]);
    console.log("Parallel results: ", results);

    // One must have alreadySubmitted === false (first to transition)
    // One must have alreadySubmitted === true (reloaded and returned already submitted result)
    const successCount = results.filter(r => !r.alreadySubmitted).length;
    const alreadySubmittedCount = results.filter(r => r.alreadySubmitted).length;
    
    if (successCount !== 1 || alreadySubmittedCount !== 1) {
      throw new Error(`Expected exactly one success (got ${successCount}) and one alreadySubmtited (got ${alreadySubmittedCount})`);
    }
    console.log("Scenario 8 Passed!");

    console.log("\n--- ALL TESTS PASSED SUCCESSFULLY! ---");

  } finally {
    // Restore original method
    evaluationPipelineService.queueEvaluation = originalQueueEvaluation;

    // Tear down database
    console.log("Cleaning test database entries...");
    if (facultyUser) await User.deleteOne({ _id: facultyUser._id });
    if (studentUser) await User.deleteOne({ _id: studentUser._id });
    if (unauthorizedStudent) await User.deleteOne({ _id: unauthorizedStudent._id });
    if (tempDept) await Department.deleteOne({ _id: tempDept._id });
    if (tempCourse) await Course.deleteOne({ _id: tempCourse._id });
    if (tempSubject) await Subject.deleteMany({ _id: { $in: [tempSubject._id].filter(Boolean) } });
    if (activeExam) await Exam.deleteMany({ _id: { $in: [activeExam._id, upcomingExam?._id, expiredExam?._id, activeExam2?._id, activeExam3?._id].filter(Boolean) } });
    if (studentUser) await AnswerSheet.deleteMany({ student: studentUser._id });

    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
