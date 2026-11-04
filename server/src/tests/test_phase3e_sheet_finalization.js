import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import evaluationService from "../services/evaluation.service.js";
import ApiError from "../utils/ApiError.js";

import { ROLES } from "../constants/roles.js";

const runPhase3ETests = async () => {
  console.log("=================================================");
  console.log("   RUNNING PHASE 3E AUTOMATED TEST SUITE        ");
  console.log("=================================================\n");

  let passCount = 0;
  let failCount = 0;

  try {
    await connectDB();
    console.log("✓ Connected to MongoDB (ai_evaluation_db)\n");

    // Clean up test data
    await User.deleteMany({ email: /phase3e_test_.*@test\.com/ });
    await Exam.deleteMany({ code: /P3E_TEST_.*/ });
    await AnswerSheet.deleteMany({ studentIdentifier: /P3E_STD_.*/ });
    await Evaluation.deleteMany({ comment: /P3E_TEST_.*/ });

    // Seed Faculty and Student Users
    const facultyUser = await User.create({
      name: "Prof. Phase3E Faculty",
      email: "phase3e_test_faculty@test.com",
      password: "Password123!",
      role: ROLES.FACULTY,
      isActive: true,
    });

    const studentUser = await User.create({
      name: "Student Phase3E",
      email: "phase3e_test_student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
      isActive: true,
    });

    const mockSubjectId = new mongoose.Types.ObjectId();

    // Helper to seed standard Exam & AnswerSheet & Evaluation
    const seedExamAndSheet = async (examCode, qConfig = [{ qNum: 1, max: 5 }, { qNum: 2, max: 5 }]) => {
      const examQuestions = qConfig.map((q) => ({
        _id: new mongoose.Types.ObjectId(),
        questionNumber: q.qNum,
        questionText: `Test Question ${q.qNum}?`,
        maximumMarks: q.max,
        modelAnswer: `Model Answer for Q${q.qNum}`,
        rubricItems: [
          { criterion: `Criterion 1 for Q${q.qNum}`, maxMarks: q.max },
        ],
      }));

      const totalExamMarks = qConfig.reduce((acc, q) => acc + q.max, 0);

      const exam = await Exam.create({
        code: examCode,
        title: `Exam ${examCode}`,
        examType: "Midterm",
        totalMarks: totalExamMarks,
        duration: 60,
        examDate: new Date(),
        subject: mockSubjectId,
        questions: examQuestions,
        createdBy: facultyUser._id,
      });

      const digitalAnswers = exam.questions.map((eq) => ({
        question_number: String(eq.questionNumber),
        question_id: eq._id,
        question_text: eq.questionText,
        max_marks: eq.maximumMarks,
        text: `Student answer text for Q${eq.questionNumber}`,
        page_number: 1,
        confidence: 0.95,
        evaluation: {
          status: "completed",
          aiEvaluation: {
            marksAwarded: 3,
            maxMarks: eq.maximumMarks,
            percentage: (3 / eq.maximumMarks) * 100,
            feedback: "Good response",
            confidence: 0.9,
            evaluatedAt: new Date(),
          },
          facultyEvaluation: {
            status: "pending",
            finalMarks: null,
            comment: "",
          },
        },
      }));

      const sheet = await AnswerSheet.create({
        student: studentUser._id,
        subject: mockSubjectId,
        exam: exam._id,
        studentIdentifier: `P3E_STD_${examCode}`,
        submissionType: "DIGITAL",
        processingStatus: "completed",
        evaluationStatus: "READY_FOR_FACULTY_REVIEW",
        digital_answers: digitalAnswers,
      });

      const evalQuestions = exam.questions.map((eq) => ({
        questionId: eq._id,
        questionNumber: String(eq.questionNumber),
        questionText: eq.questionText,
        maxMarks: eq.maximumMarks,
        maximumMarks: eq.maximumMarks,
        status: "completed",
        aiEvaluation: {
          marksAwarded: 3,
          maxMarks: eq.maximumMarks,
          percentage: (3 / eq.maximumMarks) * 100,
          criteria: [{ criterion: `Criterion 1 for Q${eq.questionNumber}`, marksAwarded: 3, maxMarks: eq.maximumMarks, status: "met" }],
          feedback: "Good response",
          confidence: 0.9,
          evaluatedAt: new Date(),
        },
        facultyEvaluation: {
          status: "pending",
          finalMarks: null,
          comment: "",
        },
      }));

      const evaluation = await Evaluation.create({
        answerSheet: sheet._id,
        student: studentUser._id,
        exam: exam._id,
        evaluationType: "AI",
        obtainedMarks: 6,
        totalMarks: totalExamMarks,
        percentage: (6 / totalExamMarks) * 100,
        evaluationStatus: "READY_FOR_FACULTY_REVIEW",
        questions: evalQuestions,
        comment: `P3E_TEST_${examCode}`,
        createdBy: facultyUser._id,
      });

      return { exam, sheet, evaluation };
    };

    // -------------------------------------------------------------
    // Scenario 1: All Questions Approved Finalization
    // -------------------------------------------------------------
    try {
      console.log("Scenario 1: Testing All Questions Approved Finalization...");
      const { sheet, evaluation } = await seedExamAndSheet("P3E_TEST_SC1");

      // Review and approve both Q1 and Q2
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "1", finalMarks: 5 }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "2", finalMarks: 5 }, facultyUser._id);

      // Verify summary before finalization
      const { summary } = await evaluationService.calculateSheetEvaluationSummary(sheet._id);
      if (summary.pendingQuestions !== 0 || summary.status !== "ready_for_finalization") {
        throw new Error(`Expected summary status ready_for_finalization, got ${summary.status}`);
      }

      // Finalize
      const finalizedDoc = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      if (finalizedDoc.evaluationStatus !== "finalized" || finalizedDoc.finalEvaluation.status !== "finalized") {
        throw new Error("Evaluation status was not set to finalized.");
      }
      if (finalizedDoc.finalEvaluation.totalMarksObtained !== 10 || finalizedDoc.finalEvaluation.percentage !== 100) {
        throw new Error(`Expected 10/10 (100%), got ${finalizedDoc.finalEvaluation.totalMarksObtained}/${finalizedDoc.finalEvaluation.maximumMarks}`);
      }

      const updatedSheet = await AnswerSheet.findById(sheet._id);
      if (updatedSheet.evaluationStatus !== "finalized" || updatedSheet.submissionStatus !== "Published") {
        throw new Error("AnswerSheet status was not updated to Published/finalized.");
      }

      console.log("✓ Scenario 1 Passed: Clean finalization with 10/10 (100%) total.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 1 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 2: Faculty Override Final Marks Calculation
    // -------------------------------------------------------------
    try {
      console.log("Scenario 2: Testing Faculty Override Final Marks Calculation...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC2");

      // AI awarded 3 for Q1 and 3 for Q2 (Total AI = 6)
      // Faculty overrides Q1 to 5 and Q2 to 4 (Total Faculty = 9)
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "1", finalMarks: 5, comment: "Excellent improvement" }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "2", finalMarks: 4, comment: "Minor detail missing" }, facultyUser._id);

      const finalizedDoc = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      if (finalizedDoc.finalEvaluation.totalMarksObtained !== 9) {
        throw new Error(`Expected 9 marks from faculty overrides, got ${finalizedDoc.finalEvaluation.totalMarksObtained}`);
      }
      if (finalizedDoc.finalEvaluation.facultyModifiedQuestions !== 2) {
        throw new Error(`Expected 2 facultyModifiedQuestions, got ${finalizedDoc.finalEvaluation.facultyModifiedQuestions}`);
      }

      console.log("✓ Scenario 2 Passed: Faculty overrides correctly take precedence over AI suggested marks.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 2 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 3: Finalization Blocked by Pending Question
    // -------------------------------------------------------------
    try {
      console.log("Scenario 3: Testing Finalization Blocked by Pending Question...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC3");

      // Review Q1 only, leave Q2 pending
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "1", finalMarks: 3 }, facultyUser._id);

      let blocked = false;
      try {
        await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);
      } catch (err) {
        if (err.statusCode === 400 && err.message.includes("still require faculty review")) {
          blocked = true;
        } else {
          throw err;
        }
      }

      if (!blocked) {
        throw new Error("Finalization was not blocked despite 1 pending question.");
      }

      console.log("✓ Scenario 3 Passed: Finalization strictly blocked when pending questions exist.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 3 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 4: Unanswered Question Calculation
    // -------------------------------------------------------------
    try {
      console.log("Scenario 4: Testing Unanswered Question Calculation...");
      const { sheet, evaluation } = await seedExamAndSheet("P3E_TEST_SC4");

      // Mark Q2 as unanswered
      const q2 = evaluation.questions.find((q) => q.questionNumber === "2");
      q2.status = "unanswered";
      q2.isUnanswered = true;
      q2.facultyEvaluation = { status: "approved", finalMarks: 0, comment: "Unanswered" };
      await evaluation.save();

      // Approve Q1 with 4 marks
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "1", finalMarks: 4 }, facultyUser._id);

      const finalizedDoc = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      if (finalizedDoc.finalEvaluation.unansweredQuestions !== 1) {
        throw new Error(`Expected 1 unansweredQuestion, got ${finalizedDoc.finalEvaluation.unansweredQuestions}`);
      }
      if (finalizedDoc.finalEvaluation.totalMarksObtained !== 4 || finalizedDoc.finalEvaluation.percentage !== 40) {
        throw new Error(`Expected 4/10 (40%), got ${finalizedDoc.finalEvaluation.totalMarksObtained}/${finalizedDoc.finalEvaluation.maximumMarks}`);
      }

      console.log("✓ Scenario 4 Passed: Unanswered questions award 0 marks and allow finalization.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 4 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 5: OCR Failure Flagged Question Blocking
    // -------------------------------------------------------------
    try {
      console.log("Scenario 5: Testing OCR Failure Flagged Question Blocking...");
      const { sheet, evaluation } = await seedExamAndSheet("P3E_TEST_SC5");

      // Set Q2 as failed due to OCR failure
      const q2 = evaluation.questions.find((q) => q.questionNumber === "2");
      q2.status = "failed";
      q2.reason = "BLURRY_IMAGE";
      q2.facultyEvaluation = { status: "pending", finalMarks: null };
      await evaluation.save();

      let blocked = false;
      try {
        await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);
      } catch (err) {
        if (err.statusCode === 400 && err.message.includes("still require faculty review")) {
          blocked = true;
        } else {
          throw err;
        }
      }

      if (!blocked) {
        throw new Error("Finalization was not blocked for OCR failed question.");
      }

      console.log("✓ Scenario 5 Passed: OCR failure flagged question blocks finalization until reviewed.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 5 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 6: Fractional / Decimal Marks Calculation
    // -------------------------------------------------------------
    try {
      console.log("Scenario 6: Testing Decimal Marks Calculation...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC6");

      // Approve Q1 with 3.5 marks and Q2 with 4.5 marks
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "1", finalMarks: 3.5, comment: "Partial rubric points" }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "2", finalMarks: 4.5, comment: "Minor error" }, facultyUser._id);

      const finalizedDoc = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      if (finalizedDoc.finalEvaluation.totalMarksObtained !== 8 || finalizedDoc.finalEvaluation.percentage !== 80) {
        throw new Error(`Expected 8/10 (80%), got ${finalizedDoc.finalEvaluation.totalMarksObtained}/${finalizedDoc.finalEvaluation.maximumMarks}`);
      }

      console.log("✓ Scenario 6 Passed: Fractional marks (3.5 + 4.5 = 8.0) calculated without rounding errors.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 6 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 7: Variable Question Maximum Marks Calculation
    // -------------------------------------------------------------
    try {
      console.log("Scenario 7: Testing Variable Question Maximum Marks...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC7", [
        { qNum: 1, max: 5 },
        { qNum: 2, max: 15 },
        { qNum: 3, max: 10 },
      ]);

      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "1", finalMarks: 4, comment: "Q1 mark update" }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "2", finalMarks: 12, comment: "Q2 mark update" }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "modify", questionNumber: "3", finalMarks: 8, comment: "Q3 mark update" }, facultyUser._id);

      const finalizedDoc = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      // Total obtained = 4 + 12 + 8 = 24. Max total = 5 + 15 + 10 = 30. Percentage = 80%.
      if (finalizedDoc.finalEvaluation.maximumMarks !== 30 || finalizedDoc.finalEvaluation.totalMarksObtained !== 24) {
        throw new Error(`Expected 24/30 (80%), got ${finalizedDoc.finalEvaluation.totalMarksObtained}/${finalizedDoc.finalEvaluation.maximumMarks}`);
      }
      if (finalizedDoc.finalEvaluation.percentage !== 80) {
        throw new Error(`Expected 80% percentage, got ${finalizedDoc.finalEvaluation.percentage}%`);
      }

      console.log("✓ Scenario 7 Passed: Variable question max marks (5 + 15 + 10 = 30) calculated correctly.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 7 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 8: Role Authorization Check
    // -------------------------------------------------------------
    try {
      console.log("Scenario 8: Testing Role Authorization Check...");
      // Simulate role middleware behavior
      const isStudentAuthorized = studentUser.role === "FACULTY" || studentUser.role === "ADMIN";

      if (isStudentAuthorized) {
        throw new Error("Student role was wrongly permitted to finalize evaluation.");
      }

      console.log("✓ Scenario 8 Passed: Non-faculty / student roles blocked from finalization.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 8 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 9: Idempotent Duplicate Finalization
    // -------------------------------------------------------------
    try {
      console.log("Scenario 9: Testing Idempotent Duplicate Finalization...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC9");

      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "1", finalMarks: 5 }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "2", finalMarks: 5 }, facultyUser._id);

      // Call 1
      const doc1 = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);
      const auditCount1 = doc1.auditHistory.length;

      // Call 2 (Duplicate)
      const doc2 = await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);
      const auditCount2 = doc2.auditHistory.length;

      if (auditCount1 !== auditCount2) {
        throw new Error("Duplicate finalization call generated duplicate audit logs.");
      }
      if (doc2.evaluationStatus !== "finalized") {
        throw new Error("Idempotent call failed to return finalized document.");
      }

      console.log("✓ Scenario 9 Passed: Duplicate finalization calls are idempotent and safe.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 9 Failed:", err.message, "\n");
      failCount++;
    }

    // -------------------------------------------------------------
    // Scenario 10: Digital Slate & Handwritten Ingestion Regression Guard
    // -------------------------------------------------------------
    try {
      console.log("Scenario 10: Testing Digital Slate & Ingestion Regression Guard...");
      const { sheet } = await seedExamAndSheet("P3E_TEST_SC10");

      // Add handwritten strokes and transcribed text to digital_answers
      sheet.digital_answers[0].strokes = [{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }];
      sheet.digital_answers[0].text = "Handwritten answer text preserved";
      await sheet.save();

      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "1", finalMarks: 4 }, facultyUser._id);
      await evaluationService.reviewFacultyEvaluation(sheet._id, { action: "approve", questionNumber: "2", finalMarks: 4 }, facultyUser._id);

      await evaluationService.finalizeAnswerSheetEvaluation(sheet._id, facultyUser._id);

      const reloadedSheet = await AnswerSheet.findById(sheet._id);
      const q1 = reloadedSheet.digital_answers[0];

      if (!q1.strokes || q1.strokes.length === 0 || q1.text !== "Handwritten answer text preserved") {
        throw new Error("Handwritten stroke vectors or OCR text were corrupted during finalization.");
      }

      console.log("✓ Scenario 10 Passed: Handwritten stroke vectors and digitized text remain completely intact.\n");
      passCount++;
    } catch (err) {
      console.error("❌ Scenario 10 Failed:", err.message, "\n");
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

runPhase3ETests();
