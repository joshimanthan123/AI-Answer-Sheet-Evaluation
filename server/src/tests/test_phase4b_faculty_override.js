import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import facultyReviewService from "../services/facultyReview.service.js";
import { ROLES } from "../constants/roles.js";

const runPhase4BTests = async () => {
  console.log("=================================================");
  console.log("   RUNNING PHASE 4B AUTOMATED TEST SUITE        ");
  console.log("=================================================\n");

  let passCount = 0;
  let failCount = 0;

  try {
    await connectDB();
    console.log("✓ Connected to MongoDB (ai_evaluation_db)\n");

    // Clean up test data
    await User.deleteMany({ email: /phase4b_test_.*@test\.com/ });
    await Exam.deleteMany({ code: /P4B_TEST_.*/ });
    await AnswerSheet.deleteMany({ studentIdentifier: /P4B_STD_.*/ });
    await Evaluation.deleteMany({ comment: /P4B_TEST_.*/ });

    // Seed Users
    const facultyUser = await User.create({
      name: "Prof. Phase4B Faculty",
      email: "phase4b_test_faculty@test.com",
      password: "Password123!",
      role: ROLES.FACULTY,
      isActive: true,
    });

    const studentUser = await User.create({
      name: "Student Phase4B",
      email: "phase4b_test_student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
      isActive: true,
    });

    const mockSubjectId = new mongoose.Types.ObjectId();

    // Helper to seed Exam, AnswerSheet, & Evaluation
    const seedTestSetup = async (examCode) => {
      const q1Id = new mongoose.Types.ObjectId();
      const q2Id = new mongoose.Types.ObjectId();

      const examQuestions = [
        {
          _id: q1Id,
          questionNumber: 1,
          questionText: "What is Polymorphism?",
          maximumMarks: 10,
          modelAnswer: "Polymorphism is the ability of an object to take on many forms.",
        },
        {
          _id: q2Id,
          questionNumber: 2,
          questionText: "Explain Abstract Classes.",
          maximumMarks: 5,
          modelAnswer: "An abstract class cannot be instantiated.",
        },
      ];

      const exam = await Exam.create({
        code: examCode,
        title: `Exam ${examCode}`,
        examType: "Midterm",
        totalMarks: 15,
        duration: 60,
        examDate: new Date(),
        subject: mockSubjectId,
        questions: examQuestions,
        createdBy: facultyUser._id,
      });

      const sheet = await AnswerSheet.create({
        student: studentUser._id,
        subject: mockSubjectId,
        exam: exam._id,
        studentIdentifier: `P4B_STD_${examCode}`,
        submissionType: "DIGITAL",
        processingStatus: "completed",
        evaluationStatus: "READY_FOR_FACULTY_REVIEW",
        reviewStatus: "FACULTY_REVIEW_IN_PROGRESS",
        digital_answers: [
          { question_number: "1", text: "Polymorphism means many forms." },
          { question_number: "2", text: "Abstract classes cannot be instantiated." },
        ],
      });

      const evalQuestions = [
        {
          questionId: q1Id,
          questionNumber: "1",
          questionText: "What is Polymorphism?",
          maxMarks: 10,
          maximumMarks: 10,
          status: "completed",
          aiMarks: 7,
          aiEvaluation: {
            marksAwarded: 7,
            maxMarks: 10,
            percentage: 70,
            feedback: "Good concise answer.",
            confidence: 0.88,
            evaluatedAt: new Date(),
          },
          facultyEvaluation: {
            status: "pending",
            finalMarks: null,
            comment: "",
          },
        },
        {
          questionId: q2Id,
          questionNumber: "2",
          questionText: "Explain Abstract Classes.",
          maxMarks: 5,
          maximumMarks: 5,
          status: "completed",
          aiMarks: 3,
          aiEvaluation: {
            marksAwarded: 3,
            maxMarks: 5,
            percentage: 60,
            feedback: "Missed key details.",
            confidence: 0.82,
            evaluatedAt: new Date(),
          },
          facultyEvaluation: {
            status: "pending",
            finalMarks: null,
            comment: "",
          },
        },
      ];

      const evaluation = await Evaluation.create({
        answerSheet: sheet._id,
        student: studentUser._id,
        exam: exam._id,
        evaluationType: "AI",
        obtainedMarks: 10,
        totalMarks: 15,
        percentage: 66.67,
        evaluationStatus: "READY_FOR_FACULTY_REVIEW",
        questions: evalQuestions,
        comment: `P4B_TEST_${examCode}`,
        createdBy: facultyUser._id,
      });

      return { exam, sheet, evaluation };
    };

    // -------------------------------------------------------------
    // Test Case 1: Accept AI Marks
    // -------------------------------------------------------------
    try {
      console.log("Test Case 1: Accept AI Marks...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC1");

      const res = await facultyReviewService.acceptAiQuestion(evaluation._id, "1", facultyUser._id);
      const q1 = res.evaluation.questions.find((q) => q.questionNumber === "1");

      if (q1.facultyEvaluation.status !== "accepted") {
        throw new Error(`Expected facultyEvaluation.status to be 'accepted', got '${q1.facultyEvaluation?.status}'`);
      }
      if (q1.facultyEvaluation.finalMarks !== 7) {
        throw new Error(`Expected finalMarks = 7, got ${q1.facultyEvaluation?.finalMarks}`);
      }
      if (q1.aiEvaluation.marksAwarded !== 7) {
        throw new Error("Original AI marks were mutated!");
      }

      console.log("✓ Test Case 1 Passed: Accept AI Marks preserved AI data and correctly updated faculty status.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 1 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 2: Override AI Marks with Valid Reason
    // -------------------------------------------------------------
    try {
      console.log("Test Case 2: Override AI Marks with Valid Reason...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC2");

      const res = await facultyReviewService.overrideQuestion(
        evaluation._id,
        "1",
        9,
        "Student answer deserves additional marks",
        "Student covered polymorphism in detail with examples.",
        facultyUser._id
      );

      const q1 = res.evaluation.questions.find((q) => q.questionNumber === "1");

      if (q1.facultyEvaluation.status !== "modified" || q1.reviewType !== "overridden") {
        throw new Error("Faculty status or reviewType not set to modified/overridden.");
      }
      if (q1.facultyEvaluation.finalMarks !== 9) {
        throw new Error(`Expected finalMarks = 9, got ${q1.facultyEvaluation?.finalMarks}`);
      }
      if (res.difference !== 2) {
        throw new Error(`Expected mark difference of +2, got ${res.difference}`);
      }

      console.log("✓ Test Case 2 Passed: Override AI Marks with valid reason calculated difference (+2.0) correctly.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 2 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 3: Invalid Marks Validation Boundary Check
    // -------------------------------------------------------------
    try {
      console.log("Test Case 3: Invalid Marks Boundary Validation...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC3");

      let caughtBelowZero = false;
      try {
        await facultyReviewService.overrideQuestion(
          evaluation._id,
          "1",
          -1,
          "OCR error",
          "Invalid mark test",
          facultyUser._id
        );
      } catch (err) {
        if (err.statusCode === 400) caughtBelowZero = true;
      }

      let caughtExceedMax = false;
      try {
        await facultyReviewService.overrideQuestion(
          evaluation._id,
          "1",
          15, // Max is 10
          "OCR error",
          "Invalid mark test",
          facultyUser._id
        );
      } catch (err) {
        if (err.statusCode === 400) caughtExceedMax = true;
      }

      if (!caughtBelowZero || !caughtExceedMax) {
        throw new Error("Invalid mark boundary validation failed to throw 400 Bad Request.");
      }

      console.log("✓ Test Case 3 Passed: Out-of-bounds faculty marks (<0 or >max) strictly rejected.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 3 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 4: Missing Override Reason / Comment Validation
    // -------------------------------------------------------------
    try {
      console.log("Test Case 4: Missing Override Reason & Comment Validation...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC4");

      let caughtEmptyReason = false;
      try {
        await facultyReviewService.overrideQuestion(evaluation._id, "1", 8, "", "No reason provided", facultyUser._id);
      } catch (err) {
        if (err.statusCode === 400) caughtEmptyReason = true;
      }

      let caughtMissingOtherComment = false;
      try {
        await facultyReviewService.overrideQuestion(evaluation._id, "1", 8, "Other", "", facultyUser._id);
      } catch (err) {
        if (err.statusCode === 400) caughtMissingOtherComment = true;
      }

      if (!caughtEmptyReason || !caughtMissingOtherComment) {
        throw new Error("Missing reason/comment validation failed.");
      }

      console.log("✓ Test Case 4 Passed: Mandatory reason and comment for 'Other' strictly enforced.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 4 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 5: AI Data Immutability & Integrity Verification
    // -------------------------------------------------------------
    try {
      console.log("Test Case 5: AI Data Immutability & Integrity Verification...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC5");

      const originalAiMarks = evaluation.questions[0].aiEvaluation.marksAwarded;
      const originalFeedback = evaluation.questions[0].aiEvaluation.feedback;
      const originalConfidence = evaluation.questions[0].aiEvaluation.confidence;

      await facultyReviewService.overrideQuestion(
        evaluation._id,
        "1",
        4,
        "AI overestimated answer",
        "Overestimated score.",
        facultyUser._id
      );

      const reloadedEval = await Evaluation.findById(evaluation._id);
      const q1 = reloadedEval.questions[0];

      if (
        q1.aiEvaluation.marksAwarded !== originalAiMarks ||
        q1.aiEvaluation.feedback !== originalFeedback ||
        q1.aiEvaluation.confidence !== originalConfidence
      ) {
        throw new Error("Original AI evaluation fields were modified during override!");
      }

      console.log("✓ Test Case 5 Passed: Original AI marks, feedback, and confidence remain 100% immutable.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 5 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 6: Single Question & Student Finalization Locking
    // -------------------------------------------------------------
    try {
      console.log("Test Case 6: Question & Student Finalization Locking...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC6");

      await facultyReviewService.acceptAiQuestion(evaluation._id, "1", facultyUser._id);
      await facultyReviewService.finalizeSingleQuestion(evaluation._id, "1", facultyUser._id);

      let caughtLockedQ1 = false;
      try {
        await facultyReviewService.overrideQuestion(
          evaluation._id,
          "1",
          10,
          "OCR error",
          "Attempt edit locked question",
          facultyUser._id
        );
      } catch (err) {
        if (err.statusCode === 400 && err.message.includes("finalized and locked")) {
          caughtLockedQ1 = true;
        }
      }

      if (!caughtLockedQ1) {
        throw new Error("Editing a finalized question was not blocked.");
      }

      console.log("✓ Test Case 6 Passed: Finalized questions are locked against further modification.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 6 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 7: Role Authorization Check
    // -------------------------------------------------------------
    try {
      console.log("Test Case 7: Role Authorization Check...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC7");

      let caughtUnauthorized = false;
      try {
        await facultyReviewService.overrideQuestion(
          evaluation._id,
          "1",
          8,
          "OCR error",
          "Student override attempt",
          studentUser._id
        );
      } catch (err) {
        if (err.statusCode === 403 || err.statusCode === 401) {
          caughtUnauthorized = true;
        }
      }

      if (!caughtUnauthorized) {
        throw new Error("Non-faculty / student user was wrongly permitted to override marks.");
      }

      console.log("✓ Test Case 7 Passed: Non-faculty / student users blocked from overriding marks.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 7 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 8: Student Total & Net Difference Recalculation
    // -------------------------------------------------------------
    try {
      console.log("Test Case 8: Student Total & Net Difference Recalculation...");
      const { evaluation } = await seedTestSetup("P4B_TEST_TC8");

      // AI awarded: Q1 = 7, Q2 = 3. Total AI = 10.
      // Faculty accepts Q1 = 7, overrides Q2 = 5 (Total Faculty = 12). Difference = +2.
      await facultyReviewService.acceptAiQuestion(evaluation._id, "1", facultyUser._id);
      await facultyReviewService.overrideQuestion(
        evaluation._id,
        "2",
        5,
        "Student answer deserves additional marks",
        "Full points for Q2",
        facultyUser._id
      );

      const finRes = await facultyReviewService.finalizeStudentEvaluation(evaluation._id, facultyUser._id);

      if (finRes.summary.totalAiMarks !== 10) {
        throw new Error(`Expected totalAiMarks = 10, got ${finRes.summary.totalAiMarks}`);
      }
      if (finRes.summary.totalFacultyFinalMarks !== 12) {
        throw new Error(`Expected totalFacultyFinalMarks = 12, got ${finRes.summary.totalFacultyFinalMarks}`);
      }
      if (finRes.summary.totalDifference !== 2) {
        throw new Error(`Expected totalDifference = +2, got ${finRes.summary.totalDifference}`);
      }

      console.log("✓ Test Case 8 Passed: Total AI (10), Total Faculty Final (12), and Net Difference (+2) calculated accurately.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 8 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Test Case 9: Full End-to-End Workflow Integration
    // -------------------------------------------------------------
    try {
      console.log("Test Case 9: Full End-to-End Workflow Integration...");
      const { evaluation, sheet } = await seedTestSetup("P4B_TEST_TC9");

      // Step 1: Start review
      await facultyReviewService.startReview(sheet._id, facultyUser._id);

      // Step 2: Accept Q1 AI marks
      await facultyReviewService.acceptAiQuestion(evaluation._id, "1", facultyUser._id);

      // Step 3: Override Q2 marks
      await facultyReviewService.overrideQuestion(
        evaluation._id,
        "2",
        4,
        "Partial concept accepted",
        "Accepted partial credit for Q2",
        facultyUser._id
      );

      // Step 4: Finalize single questions
      await facultyReviewService.finalizeSingleQuestion(evaluation._id, "1", facultyUser._id);
      await facultyReviewService.finalizeSingleQuestion(evaluation._id, "2", facultyUser._id);

      // Step 5: Finalize student evaluation
      const finalRes = await facultyReviewService.finalizeStudentEvaluation(evaluation._id, facultyUser._id);

      if (finalRes.evaluation.evaluationStatus !== "finalized" || finalRes.ansSheet.reviewStatus !== "FINALIZED") {
        throw new Error("Student evaluation status was not updated to finalized.");
      }

      if (finalRes.evaluation.auditHistory.length < 5) {
        throw new Error("Audit history did not capture all workflow actions.");
      }

      console.log("✓ Test Case 9 Passed: Full end-to-end faculty override and finalization pipeline executed successfully.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Test Case 9 Failed:", err.message, "\n");
      failCount++;
    }

    // Final Report Summary
    console.log("=================================================");
    console.log(`   TEST SUITE SUMMARY: ${passCount} PASSED / ${failCount} FAILED   `);
    console.log("=================================================");

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Fatal Test Suite Error:", err);
    process.exit(1);
  }
};

runPhase4BTests();
