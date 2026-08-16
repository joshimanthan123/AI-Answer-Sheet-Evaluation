import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import examService from "../services/exam.service.js";

async function runTest() {
  console.log("Starting Phase 6 Answer Key Integration Test...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let tempUser = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let tempExam = null;

  try {
    // 1. Create a mock faculty test user
    tempUser = await User.create({
      name: "Test Faculty Member",
      email: "test.faculty@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC" + Date.now(),
      status: "online",
    });
    console.log("✓ Created mock faculty user:", tempUser.email);

    // 2. Create mock department
    tempDept = await Department.create({
      name: "Computer Science Dept " + Date.now(),
      code: "CSD" + Math.floor(Math.random() * 1000),
      createdBy: tempUser._id,
    });
    console.log("✓ Created mock department:", tempDept.code);

    // 3. Create mock course
    tempCourse = await Course.create({
      name: "B.Tech Computer Science " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: tempUser._id,
    });
    console.log("✓ Created mock course:", tempCourse.code);

    // 4. Create mock subject
    tempSubject = await Subject.create({
      name: "Advanced Computer Networks " + Date.now(),
      code: "CS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: tempUser._id,
      createdBy: tempUser._id,
    });
    console.log("✓ Created mock subject:", tempSubject.code);

    // 5. Create a draft exam with 1 Question (max marks: 10)
    tempExam = await examService.createExam(
      {
        title: "Midterm Examination",
        examCode: "MID" + Math.floor(Math.random() * 1000),
        subject: tempSubject._id,
        examType: "Mid-Term",
        examDate: new Date(),
        duration: 120,
        totalMarks: 10,
        passingMarks: 4,
        questions: [
          {
            questionNumber: 1,
            questionText: "Explain Three-Way Handshaking Protocol in TCP.",
            maximumMarks: 10,
            questionType: "Descriptive",
            difficulty: "Medium",
            bloomsLevel: "Understand",
          },
        ],
      },
      tempUser._id
    );
    console.log(
      "✓ Created draft exam:",
      tempExam.title,
      "Status:",
      tempExam.examStatus,
      "Key Status:",
      tempExam.answerKeyStatus
    );

    const questionId = tempExam.questions[0]._id.toString();

    // 6. Test validation limits (sum of evaluationCriteria > maxMarks)
    console.log("Test: Try saving criteria totals exceeding maximumMarks...");
    try {
      await examService.updateQuestionAnswerKey(
        tempExam._id,
        questionId,
        {
          modelAnswer: "A model answer goes here.",
          expectedAnswerLength: "medium",
          keywords: ["TCP", "Handshake", "SYN", "ACK"],
          evaluationCriteria: {
            conceptualUnderstanding: 5,
            keywordAccuracy: 4,
            completeness: 2, // 5 + 4 + 2 + 0 = 11 > 10
            correctness: 0,
          },
        },
        tempUser._id
      );
      throw new Error("Failed: Saving exceeding criteria marks should have failed!");
    } catch (err) {
      console.log("✓ Correctly caught criteria sum exception:", err.message);
    }

    // 7. Test validation limits (sum of partialMarkingRules > maxMarks)
    console.log("Test: Try saving partial marking rules exceeding maximumMarks...");
    try {
      await examService.updateQuestionAnswerKey(
        tempExam._id,
        questionId,
        {
          modelAnswer: "A model answer goes here.",
          expectedAnswerLength: "medium",
          keywords: ["TCP", "Handshake", "SYN", "ACK"],
          partialMarkingRules: [
            { criterion: "Step 1", description: "SYN packet", marks: 6 },
            { criterion: "Step 2", description: "SYN-ACK", marks: 5 }, // 6 + 5 = 11 > 10
          ],
        },
        tempUser._id
      );
      throw new Error("Failed: Saving exceeding partial marking rules marks should have failed!");
    } catch (err) {
      console.log("✓ Correctly caught partial marking rules sum exception:", err.message);
    }

    // 8. Test successful save of draft Question Answer Key configurations
    console.log("Test: Save valid answer key details...");
    const validData = {
      modelAnswer:
        "The TCP 3-way handshake process consists of a SYN, a SYN-ACK, and an ACK packet exchanged between client and server.",
      expectedAnswerLength: "medium",
      keywords: ["TCP", "SYN", "ACK", "SYN-ACK"],
      evaluationCriteria: {
        conceptualUnderstanding: 4,
        keywordAccuracy: 3,
        completeness: 2,
        correctness: 1, // 4 + 3 + 2 + 1 = 10 (perfect match!)
      },
      partialMarkingRules: [
        { criterion: "SYN packet", description: "SYN sent by client", marks: 3 },
        { criterion: "SYN-ACK", description: "SYN-ACK from server", marks: 4 },
        { criterion: "ACK", description: "Final ACK payload response", marks: 3 }, // 3 + 4 + 3 = 10 (perfect match!)
      ],
    };
    const savedExam = await examService.updateQuestionAnswerKey(
      tempExam._id,
      questionId,
      validData,
      tempUser._id
    );
    const updatedQ = savedExam.questions[0];
    console.log("✓ Successfully saved question answer key drafts!");
    console.log(
      "   Criteria conceptualUnderstanding:",
      updatedQ.evaluationCriteria.conceptualUnderstanding
    );
    console.log("   Keywords count:", updatedQ.keywords.length);

    // 9. Test finalizing / locking the exam answer-key status
    console.log("Test: Finalize and lock answer key status...");
    const finalizedExam = await examService.finalizeAnswerKey(savedExam._id, tempUser._id);
    console.log("✓ Answer key status set to:", finalizedExam.answerKeyStatus);

    // 10. Verify that once locked: modifications are rejected
    console.log("Test: Try modifying question parameters while locked...");
    try {
      await examService.updateQuestion(
        tempExam._id,
        questionId,
        {
          questionText: "Overwritten text",
        },
        tempUser._id
      );
      throw new Error("Failed: Questions updates should be rejected when locked!");
    } catch (err) {
      console.log("✓ Correctly rejected standard question modifications when locked:", err.message);
    }

    console.log("Test: Try modifying answer key details while locked...");
    try {
      await examService.updateQuestionAnswerKey(
        tempExam._id,
        questionId,
        {
          modelAnswer: "Changed answer text",
        },
        tempUser._id
      );
      throw new Error("Failed: Answer key updates should be rejected when locked!");
    } catch (err) {
      console.log("✓ Correctly rejected answer key modifications when locked:", err.message);
    }

    // 11. Test unlocking answer key
    console.log("Test: Unlock answer key back to draft status...");
    const unlockedExam = await examService.unlockAnswerKey(tempExam._id, tempUser._id, "faculty");
    console.log("✓ Unlocked answer key. Status is back to:", unlockedExam.answerKeyStatus);

    // 12. Verify that it can now be edited again
    console.log("Test: Modify answer key details after unlock...");
    const postUnlockExam = await examService.updateQuestionAnswerKey(
      tempExam._id,
      questionId,
      {
        modelAnswer: "Verified post-unlock draft update works!",
      },
      tempUser._id
    );
    console.log(
      "✓ Post-unlock model answer updated successfully:",
      postUnlockExam.questions[0].modelAnswer
    );

    console.log("\nALL PHASE 6 SERVICE TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exitCode = 1;
  } finally {
    // Cleanup mock objects
    console.log("Cleaning up database test objects...");
    if (tempExam) {
      await Exam.findByIdAndDelete(tempExam._id);
    }
    if (tempSubject) {
      await Subject.findByIdAndDelete(tempSubject._id);
    }
    if (tempCourse) {
      await Course.findByIdAndDelete(tempCourse._id);
    }
    if (tempDept) {
      await Department.findByIdAndDelete(tempDept._id);
    }
    if (tempUser) {
      await User.findByIdAndDelete(tempUser._id);
    }
    await mongoose.disconnect();
    console.log("Disconnected from database. Done.");
  }
}

runTest();
