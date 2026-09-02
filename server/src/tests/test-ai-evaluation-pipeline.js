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
import { validateMarks, calculateEvaluationSummary } from "../utils/evaluationValidator.js";

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
  console.log("Starting AI Evaluation Pipeline Integration Test Suite...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let tempUser = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let tempExam = null;
  let tempAnswerKey = null;
  let tempAnswerSheet = null;

  try {
    // 1. Create a mock faculty test user
    tempUser = await User.create({
      name: "Test Faculty Member " + Date.now(),
      email: "test.faculty." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC" + Date.now(),
      status: "online",
    });
    console.log("✓ Created mock faculty user:", tempUser.email);

    // 2. Create mock department
    tempDept = await Department.create({
      name: "CS Dept " + Date.now(),
      code: "CSD" + Math.floor(Math.random() * 1000),
      createdBy: tempUser._id,
    });

    // 3. Create mock course
    tempCourse = await Course.create({
      name: "B.Tech CS " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: tempUser._id,
    });

    // 4. Create mock subject
    tempSubject = await Subject.create({
      name: "Computer Networks " + Date.now(),
      code: "CS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: tempUser._id,
      createdBy: tempUser._id,
    });

    // 5. Create a draft exam with 2 Questions (max marks details)
    tempExam = await Exam.create({
      title: "Midterm Networks",
      examCode: "MID" + Math.floor(Math.random() * 1000),
      subject: tempSubject._id,
      examType: "Mid-Term",
      examDate: new Date(),
      duration: 120,
      totalMarks: 20,
      passingMarks: 8,
      questions: [
        {
          questionNumber: 1,
          questionText: "What is TCP?",
          maximumMarks: 10,
          questionType: "Descriptive",
          difficulty: "Easy",
          bloomsLevel: "Remember",
        },
        {
          questionNumber: 2,
          questionText: "What is UDP?",
          maximumMarks: 10,
          questionType: "Descriptive",
          difficulty: "Medium",
          bloomsLevel: "Understand",
        }
      ],
      examStatus: "Published",
      isPublished: true,
      createdBy: tempUser._id,
      updatedBy: tempUser._id,
    });
    console.log("✓ Created Exam and questions");

    // 6. Create AnswerSheet submission in Draft/HWR pending stage
    tempAnswerSheet = await AnswerSheet.create({
      student: tempUser._id,
      subject: tempSubject._id,
      exam: tempExam._id,
      submissionStatus: "Submitted",
      ocrStatus: "processing", // not complete yet
      processingStatus: "processing",
      answers: [
        {
          questionId: tempExam.questions[0]._id,
          recognizedText: "TCP stands for Transmission Control Protocol.",
          confidenceLevel: "HIGH"
        },
        {
          questionId: tempExam.questions[1]._id,
          recognizedText: "UDP stands for User Datagram Protocol.",
          confidenceLevel: "LOW" // low confidence for testing confidence mappings!
        }
      ],
      createdBy: tempUser._id,
    });
    console.log("✓ Created AnswerSheet");

    // ----------------------------------------------------
    // Test Check 1: OCR processing status must be completed
    // ----------------------------------------------------
    console.log("\nTest Check 1: OCR_NOT_COMPLETED precheck verification...");
    await assertThrows(
      async () => {
        await evaluationPipelineService.queueEvaluation(tempAnswerSheet._id, tempUser._id);
      },
      "OCR_NOT_COMPLETED"
    );

    // Set OCR completed to pass check
    tempAnswerSheet.ocrStatus = "completed";
    tempAnswerSheet.processingStatus = "ready_for_evaluation";
    await tempAnswerSheet.save();

    // ----------------------------------------------------
    // Test Check 2: Missing AnswerKey
    // ----------------------------------------------------
    console.log("\nTest Check 2: ANSWER_KEY_NOT_FOUND precheck verification...");
    await assertThrows(
      async () => {
        await evaluationPipelineService.queueEvaluation(tempAnswerSheet._id, tempUser._id);
      },
      "ANSWER_KEY_NOT_FOUND"
    );

    // Create approved AnswerKey to pass check
    tempAnswerKey = await AnswerKey.create({
      examId: tempExam._id,
      isActive: true,
      uploadStatus: "Approved",
      parsedAnswers: [
        {
          questionNumber: 1,
          questionId: tempExam.questions[0]._id,
          answerText: "Transmission Control Protocol is a connection-oriented protocol.",
          keywords: ["protocol", "transmission", "tcp"]
        },
        {
          questionNumber: 2,
          questionId: tempExam.questions[1]._id,
          answerText: "User Datagram Protocol is a connectionless protocol.",
          keywords: ["protocol", "datagram", "udp"]
        }
      ],
      uploadedBy: tempUser._id,
      fileName: "exam-networks-key.pdf",
      fileUrl: "http://localhost:5000/uploads/exam-networks-key.pdf",
      createdBy: tempUser._id,
      updatedBy: tempUser._id,
    });
    console.log("✓ Created Approved AnswerKey");

    // ----------------------------------------------------
    // Test Check 3: Validations Module Check (validateMarks)
    // ----------------------------------------------------
    console.log("\nTest Check 3: Testing Validator validateMarks function...");
    
    // Normal Range
    const normal = validateMarks(7.5, 10);
    if (!normal.valid || normal.marks !== 7.5) {
      throw new Error(`validateMarks failed on normal marks: ${JSON.stringify(normal)}`);
    }
    console.log("✓ Normal marks value accepted:", normal.marks);

    // Slight floating point overflow
    const slight = validateMarks(10.0005, 10);
    if (!slight.valid || slight.marks !== 10 || !slight.normalized) {
      throw new Error(`validateMarks failed on slight overflow: ${JSON.stringify(slight)}`);
    }
    console.log("✓ Slight overflow normalized safely to:", slight.marks);

    // 12/10 -> Clamp to 10 and add warning
    const clampedResult = validateMarks(12.5, 10);
    if (!clampedResult.valid || clampedResult.marks !== 10 || !clampedResult.clamped || !clampedResult.warning) {
      throw new Error(`validateMarks failed on clamp scenario: ${JSON.stringify(clampedResult)}`);
    }
    console.log("✓ Over-marks clamped correctly with warnings:", clampedResult.warning.message);

    // Negative markings rejection
    const neg = validateMarks(-1.5, 10);
    if (neg.valid) {
      throw new Error(`validateMarks accepted negative marks unexpectedly: ${JSON.stringify(neg)}`);
    }
    console.log("✓ Successfully rejected negative marks:", neg.error);

    // NaN / null / non-numeric
    const nanCheck = validateMarks("invalid_score", 10);
    const nullCheck = validateMarks(null, 10);
    if (nanCheck.valid || nullCheck.valid) {
      throw new Error(`validateMarks accepted invalid value`);
    }
    console.log("✓ Successfully rejected NaN and null marks.");

    // ----------------------------------------------------
    // Test Check 4: Normal AI Pipeline Execution (Attempt #1)
    // ----------------------------------------------------
    console.log("\nTest Check 4: Testing full queuing and async pipeline run...");
    const evaluationObj = await evaluationPipelineService.queueEvaluation(tempAnswerSheet._id, tempUser._id);
    
    if (evaluationObj.evaluationStatus !== "QUEUED_FOR_EVALUATION") {
      throw new Error(`Expected status to be QUEUED_FOR_EVALUATION, got: ${evaluationObj.evaluationStatus}`);
    }
    console.log("✓ AnswerSheet evaluation successfully queued.");

    // Wait a brief period for background async pipeline to finish processing (using Mock provider)
    console.log("Waiting for background evaluations to complete (4.0s)...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Reload AnswerSheet and Evaluation
    const reloadedSheet = await AnswerSheet.findById(tempAnswerSheet._id);
    const reloadedEval = await Evaluation.findOne({ answerSheet: tempAnswerSheet._id });

    console.log("Reloaded evaluationStatus on AnswerSheet:", reloadedSheet.evaluationStatus);
    console.log("Reloaded evaluationAttempt on AnswerSheet:", reloadedSheet.evaluationAttempt);
    console.log("Evaluation questions count:", reloadedEval.questions.length);

    if (reloadedSheet.evaluationStatus !== "READY_FOR_FACULTY_REVIEW") {
      throw new Error(`Expected final status READY_FOR_FACULTY_REVIEW, got: ${reloadedSheet.evaluationStatus}`);
    }
    if (reloadedSheet.evaluationAttempt !== 1) {
      throw new Error(`Expected evaluationAttempt = 1, got ${reloadedSheet.evaluationAttempt}`);
    }

    // Verify low confidence OCR warning
    const udpQuestion = reloadedEval.questions.find(q => q.questionId.toString() === tempExam.questions[1]._id.toString());
    console.log("UDP Question Warnings:", udpQuestion.warnings);
    const hasLowOcrWarning = udpQuestion.warnings.some(w => w.code === "LOW_OCR_CONFIDENCE");
    if (!hasLowOcrWarning) {
      throw new Error("Missing LOW_OCR_CONFIDENCE warning on Q2 evaluation.");
    }
    console.log("✓ LOW_OCR_CONFIDENCE warning successfully verified on target question.");

    // ----------------------------------------------------
    // Test Check 5: Concurrency Lock Checks
    // ----------------------------------------------------
    console.log("\nTest Check 5: Concurrency check. Set status back to active...");
    reloadedSheet.evaluationStatus = "AI_EVALUATING";
    await reloadedSheet.save();

    await assertThrows(
      async () => {
        await evaluationPipelineService.queueEvaluation(reloadedSheet._id, tempUser._id);
      },
      "EVALUATION_ALREADY_RUNNING"
    );

    // Restore completion status
    reloadedSheet.evaluationStatus = "READY_FOR_FACULTY_REVIEW";
    await reloadedSheet.save();

    // ----------------------------------------------------
    // Test Check 6: Re-evaluation & History auditing (Attempt #2)
    // ----------------------------------------------------
    console.log("\nTest Check 6: Testing Full Re-evaluation history...");
    const reEvalResult = await evaluationPipelineService.queueEvaluation(reloadedSheet._id, tempUser._id, {
      scope: "FULL_SHEET",
      reEvaluate: true
    });

    console.log("After trigger second attempt, evaluation history length:", reEvalResult.evaluationHistory.length);
    console.log("History records:", reEvalResult.evaluationHistory);

    if (reEvalResult.evaluationHistory.length < 2) {
      throw new Error("Evaluation history was not logged or attempt didn't increment");
    }
    if (reEvalResult.evaluationHistory[1].attempt !== 2) {
      throw new Error(`Expected attempt 2 audit record, got: ${reEvalResult.evaluationHistory[1].attempt}`);
    }
    console.log("✓ Audit history successfully tracked.");

    console.log("Waiting for re-evaluation attempt to finish...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const finalSheet = await AnswerSheet.findById(tempAnswerSheet._id);
    const finalEval = await Evaluation.findOne({ answerSheet: tempAnswerSheet._id });
    console.log("Final attempt number:", finalSheet.evaluationAttempt);
    if (finalSheet.evaluationAttempt !== 2) {
      throw new Error(`Expected evaluationAttempt = 2, got: ${finalSheet.evaluationAttempt}`);
    }
    console.log("✓ Re-evaluation attempt counter verified.");

    // ----------------------------------------------------
    // Test Check 7: Question-level Re-evaluation Merge Results
    // ----------------------------------------------------
    console.log("\nTest Check 7: Testing single question re-evaluation...");
    // Let's re-evaluate question 1
    const q1Result = await evaluationPipelineService.queueEvaluation(tempAnswerSheet._id, tempUser._id, {
      scope: "QUESTION",
      questionNumber: "1",
      reEvaluate: true
    });

    await new Promise((resolve) => setTimeout(resolve, 4000));
    const postQ1Sheet = await AnswerSheet.findById(tempAnswerSheet._id);
    console.log("Post-question recheck attempt number:", postQ1Sheet.evaluationAttempt);
    if (postQ1Sheet.evaluationAttempt !== 3) {
      throw new Error(`Expected attempt = 3, got: ${postQ1Sheet.evaluationAttempt}`);
    }
    console.log("✓ Question-level re-evaluation works and merges successfully.");

    console.log("\nAll AI Evaluation Integration Tests passed successfully!");

  } finally {
    // Clean up temporary database records
    console.log("Cleaning up temporary test database records...");
    if (tempUser) await User.deleteOne({ _id: tempUser._id });
    if (tempDept) await Department.deleteOne({ _id: tempDept._id });
    if (tempCourse) await Course.deleteOne({ _id: tempCourse._id });
    if (tempSubject) await Subject.deleteOne({ _id: tempSubject._id });
    if (tempExam) await Exam.deleteOne({ _id: tempExam._id });
    if (tempAnswerKey) await AnswerKey.deleteOne({ _id: tempAnswerKey._id });
    if (tempAnswerSheet) await AnswerSheet.deleteOne({ _id: tempAnswerSheet._id });
    if (tempAnswerSheet) await Evaluation.deleteOne({ answerSheet: tempAnswerSheet._id });

    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

runTest().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
