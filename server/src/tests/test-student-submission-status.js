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

async function runTests() {
  console.log("Starting Student Submission Status & Results Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let facultyUser = null;
  let studentUser = null;
  let unauthorizedStudent = null;

  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let activeExam = null;

  let submissionId = null;

  try {
    // 1. Setup Users & departments
    facultyUser = await User.create({
      name: "Sub Faculty P5",
      email: "faculty.p5@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LECP5" + Date.now(),
    });

    tempDept = await Department.create({
      name: "CE Department P5 " + Date.now(),
      code: "CEP5" + Date.now(),
      createdBy: facultyUser._id,
    });

    studentUser = await User.create({
      name: "Sub Student P5",
      email: "student.p5@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDP5" + Date.now(),
      semester: 5,
      department: tempDept.code,
    });

    unauthorizedStudent = await User.create({
      name: "Sub Unauth Student P5",
      email: "unauth.p5@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDUNAUTHP5" + Date.now(),
      semester: 1,
      department: "EC",
    });

    tempCourse = await Course.create({
      name: "BE CE P5 " + Date.now(),
      code: "BECEP5" + Date.now(),
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: facultyUser._id,
    });

    tempSubject = await Subject.create({
      name: "CE Subject P5 " + Date.now(),
      code: "CS505" + Date.now(),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });

    const now = new Date();
    const activeStart = new Date(now.getTime() - 15 * 60 * 1000);
    const activeEnd = new Date(now.getTime() + 45 * 60 * 1000);

    const question1Id = new mongoose.Types.ObjectId();
    const question2Id = new mongoose.Types.ObjectId();

    activeExam = await Exam.create({
      title: "P5 Architecture Exam",
      examCode: "CS505-ACT",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 30,
      createdBy: facultyUser._id,
      isPublished: true,
      questions: [
        {
          _id: question1Id,
          questionNumber: 1,
          questionText: "What is MVC?",
          maximumMarks: 10,
        },
        {
          _id: question2Id,
          questionNumber: 2,
          questionText: "What is Dependency Injection?",
          maximumMarks: 20,
        },
      ],
    });

    // Create an initial AnswerSheet for our student
    const sheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: activeExam._id,
      submissionStatus: "Submitted",
      processingStatus: "ready_for_evaluation",
      submittedAt: new Date(),
      answers: [
        { questionId: question1Id, handwrittenData: "MVC path info" },
        { questionId: question2Id, handwrittenData: "DI path info" },
      ],
    });
    submissionId = sheet._id;

    console.log("AnswerSheet setup completed with ID: " + submissionId);

    // --- Scenario 1: Submitted Status (20% progress) ---
    console.log("\n--- Scenario 1: Submitted Status ---");
    let statusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State: ", statusPayload.pipeline);
    if (statusPayload.pipeline.status !== "submitted" || statusPayload.pipeline.progress !== 20) {
      throw new Error(`Scenario 1 Failed! Expected status: submitted, progress: 20. Got ${JSON.stringify(statusPayload.pipeline)}`);
    }
    console.log("Scenario 1 Passed!");

    // --- Scenario 2: HWR Processing (40% progress) ---
    console.log("\n--- Scenario 2: HWR Processing Status ---");
    await AnswerSheet.findByIdAndUpdate(submissionId, {
      $set: { processingStatus: "processing", ocrStatus: "processing" },
    });
    statusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State: ", statusPayload.pipeline);
    if (statusPayload.pipeline.status !== "processing" || statusPayload.pipeline.progress !== 40) {
      throw new Error(`Scenario 2 Failed! Expected status: processing, progress: 40. Got ${JSON.stringify(statusPayload.pipeline)}`);
    }
    console.log("Scenario 2 Passed!");

    // --- Scenario 3: AI Evaluation (60% progress) ---
    console.log("\n--- Scenario 3: AI Evaluation Status ---");
    await AnswerSheet.findByIdAndUpdate(submissionId, {
      $set: { submissionStatus: "Pending AI Evaluation", processingStatus: "completed", ocrStatus: "completed" },
    });
    const tempEval = await Evaluation.create({
      answerSheet: submissionId,
      evaluationType: "AI",
      obtainedMarks: 22,
      totalMarks: 30,
      percentage: 73.3,
      evaluationStatus: "AI_PENDING",
      createdBy: facultyUser._id,
    });
    statusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State: ", statusPayload.pipeline);
    if (statusPayload.pipeline.status !== "evaluating" || statusPayload.pipeline.progress !== 60) {
      throw new Error(`Scenario 3 Failed! Expected status: evaluating, progress: 60. Got ${JSON.stringify(statusPayload.pipeline)}`);
    }
    console.log("Scenario 3 Passed!");

    // --- Scenario 4: Faculty Review (80% progress) ---
    console.log("\n--- Scenario 4: Faculty Review Status ---");
    await AnswerSheet.findByIdAndUpdate(submissionId, {
      $set: { submissionStatus: "Faculty Review" },
    });
    await Evaluation.findByIdAndUpdate(tempEval._id, {
      $set: { evaluationStatus: "FACULTY_REVIEW" },
    });
    statusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State: ", statusPayload.pipeline);
    if (statusPayload.pipeline.status !== "faculty_review" || statusPayload.pipeline.progress !== 80) {
      throw new Error(`Scenario 4 Failed! Expected status: faculty_review, progress: 80. Got ${JSON.stringify(statusPayload.pipeline)}`);
    }
    console.log("Scenario 4 Passed!");

    // --- Scenario 5: Published Result (100% progress) ---
    console.log("\n--- Scenario 5: Published Result Status ---");
    await AnswerSheet.findByIdAndUpdate(submissionId, {
      $set: { submissionStatus: "Published" },
    });
    await Evaluation.findByIdAndUpdate(tempEval._id, {
      $set: {
        evaluationStatus: "PUBLISHED",
        grade: "B+",
        questions: [
          {
            questionId: question1Id,
            aiAwardedMarks: 8,
            finalAwardedMarks: 8,
            feedback: "Great structure description",
          },
          {
            questionId: question2Id,
            aiAwardedMarks: 14,
            finalAwardedMarks: 15, // faculty override
            facultyComment: "Private faculty comment here; should be hidden",
            feedback: "Detailed answer",
          },
        ],
      },
    });
    statusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State: ", statusPayload.pipeline);
    if (statusPayload.pipeline.status !== "published" || statusPayload.pipeline.progress !== 100) {
      throw new Error(`Scenario 5 Failed! Expected status: published, progress: 100. Got ${JSON.stringify(statusPayload.pipeline)}`);
    }

    // Call result endpoint to verify safe payload
    const resultPayload = await studentExamService.getStudentExamResult(studentUser._id, activeExam._id);
    console.log("Exposed Result Details: ", JSON.stringify(resultPayload, null, 2));

    // Assert that result response contains safe/expected fields only
    if (
      !resultPayload.exam ||
      resultPayload.exam.name !== "P5 Architecture Exam" ||
      resultPayload.result.obtainedMarks !== 22 ||
      resultPayload.result.grade !== "B+" ||
      resultPayload.questions.length !== 2
    ) {
      throw new Error("Scenario 5 Failed: Safe result payload mapping error.");
    }

    // Verify metadata exclusion
    const qWithSecret = resultPayload.questions.find(q => q.feedback.includes("Detailed answer"));
    if (qWithSecret && (qWithSecret.facultyComment !== undefined || qWithSecret.aiMetadata !== undefined)) {
      throw new Error("Scenario 5 Failed: Private faculty comment or AI metadata leaked to student.");
    }

    console.log("Scenario 5 Passed!");

    // --- Scenario 6: Unpublished Result Access Block (403) ---
    console.log("\n--- Scenario 6: Unpublished Result Access Block ---");
    // Change evaluationStatus back to FACULTY_REVIEW
    await Evaluation.findByIdAndUpdate(tempEval._id, {
      $set: { evaluationStatus: "FACULTY_REVIEW" },
    });

    try {
      await studentExamService.getStudentExamResult(studentUser._id, activeExam._id);
      throw new Error("Scenario 6 Failed: Accessed unpublished result without exception.");
    } catch (err) {
      console.log("Exception caught successfully (expected): " + err.message);
      if (err.statusCode !== 403) {
        throw new Error("Scenario 6 Failed: Wrong status code. Expected 403, got " + err.statusCode);
      }
    }
    console.log("Scenario 6 Passed!");

    // --- Scenario 7: Unauthorized Student Access Block (403) ---
    console.log("\n--- Scenario 7: Unauthorized Student Access Block ---");
    // Verify unauthorizedStudent cannot request studentUser's submission status
    try {
      await studentExamService.getStudentSubmissionStatus(unauthorizedStudent._id, activeExam._id);
      throw new Error("Scenario 7 Failed: Unauthorized student was able to query submission status.");
    } catch (err) {
      console.log("Exception status caught: " + err.message);
      if (err.statusCode !== 403) {
        throw new Error("Scenario 7 Failed: Expected 403 for unauthorized access.");
      }
    }
    console.log("Scenario 7 Passed!");

    // --- Scenario 8: Processing Failure (preserves progress) ---
    console.log("\n--- Scenario 8: Processing Failure ---");
    // Reset submissionStatus and set evaluationStatus to FAILED
    await AnswerSheet.findByIdAndUpdate(submissionId, {
      $set: { submissionStatus: "Pending AI Evaluation" },
    });
    await Evaluation.findByIdAndUpdate(tempEval._id, {
      $set: { evaluationStatus: "FAILED" },
    });
    const failedStatusPayload = await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
    console.log("Returned Pipeline State on Failure: ", failedStatusPayload.pipeline);
    // It failed in the AI evaluating phase, so progress should remain 60%
    if (failedStatusPayload.pipeline.status !== "failed" || failedStatusPayload.pipeline.progress !== 60) {
      throw new Error(`Scenario 8 Failed! Expected status: failed, progress: 60. Got ${JSON.stringify(failedStatusPayload.pipeline)}`);
    }
    console.log("Scenario 8 Passed!");

    // --- Scenario 9: Empty Submission throws 404 ---
    console.log("\n--- Scenario 9: Empty Submission ---");
    // Delete sheet and evaluation
    await AnswerSheet.findByIdAndDelete(submissionId);
    await Evaluation.findByIdAndDelete(tempEval._id);

    try {
      await studentExamService.getStudentSubmissionStatus(studentUser._id, activeExam._id);
      throw new Error("Scenario 9 Failed: Empty submission did not raise 404.");
    } catch (err) {
      console.log("Exception caught successfully: " + err.message);
      if (err.statusCode !== 404) {
        throw new Error("Scenario 9 Failed: Expected 404 for empty submission status.");
      }
    }
    console.log("Scenario 9 Passed!");

    console.log("\n--- ALL TESTS PASSED SUCCESSFULLY! ---");

  } finally {
    console.log("Cleaning test database entries...");
    if (facultyUser) await User.deleteMany({ _id: { $in: [facultyUser._id, studentUser?._id, unauthorizedStudent?._id].filter(Boolean) } });
    if (tempDept) await Department.deleteMany({ _id: tempDept._id });
    if (tempCourse) await Course.deleteMany({ _id: tempCourse._id });
    if (tempSubject) await Subject.deleteMany({ _id: tempSubject._id });
    if (activeExam) await Exam.deleteMany({ _id: activeExam._id });
    if (submissionId) await AnswerSheet.deleteMany({ _id: submissionId });

    console.log("Disconnecting from database...");
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

runTests().catch(err => {
  console.error("Test execution failed: " + err.message);
  process.exit(1);
});
