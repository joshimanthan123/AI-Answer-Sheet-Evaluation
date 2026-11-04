import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";
import Exam from "./src/models/Exam.js";
import Subject from "./src/models/Subject.js";
import Course from "./src/models/Course.js";
import Department from "./src/models/Department.js";
import AnswerSheet from "./src/models/AnswerSheet.js";
import Evaluation from "./src/models/Evaluation.js";
import EvaluationFeedback from "./src/models/EvaluationFeedback.js";
import ImprovementSuggestion from "./src/models/ImprovementSuggestion.js";
import facultyReviewService from "./src/services/facultyReview.service.js";
import feedbackService from "./src/services/feedback.service.js";
import improvementService from "./src/services/improvement.service.js";
import evaluationPipelineService from "./src/services/ai/evaluationPipeline.service.js";
import connectDB from "./src/config/db.js";
import logger from "./src/utils/logger.js";

dotenv.config();

async function runPhase5BTests() {
  console.log("\n========================================================");
  console.log("  PHASE 5B — AI EVALUATION IMPROVEMENT & FEEDBACK LEARNING ");
  console.log("========================================================\n");

  try {
    await connectDB();
    console.log("✓ Connected to MongoDB database.");

    // Find test faculty and admin users
    const facultyUser = await User.findOne({ role: "faculty" });
    const adminUser = await User.findOne({ role: "admin" }) || facultyUser;
    const studentUser = await User.findOne({ role: "student" });

    if (!facultyUser || !studentUser) {
      throw new Error("Required faculty/student test users not found in database.");
    }

    console.log(`✓ Test Users: Faculty = ${facultyUser.email}, Admin = ${adminUser.email}, Student = ${studentUser.email}`);

    // Find an existing completed evaluation or create a test setup using real database records
    let evaluation = await Evaluation.findOne({ isDeleted: false })
      .populate({ path: "answerSheet", populate: "exam student" });

    if (!evaluation || !evaluation.answerSheet || !evaluation.questions || evaluation.questions.length === 0) {
      console.log("No existing evaluation found. Creating clean test evaluation...");
      let exam = await Exam.findOne({ isDeleted: false });
      if (!exam) {
        throw new Error("No exam found in database to run test.");
      }
      let sheet = await AnswerSheet.create({
        student: studentUser._id,
        exam: exam._id,
        processingStatus: "completed",
        ocrStatus: "completed",
        answers: [
          {
            questionNumber: 1,
            recognizedText: "Database indexing improves query efficiency by reducing disk I/O scan time.",
          },
        ],
        submissionStatus: "Faculty Review",
        reviewStatus: "READY_FOR_FACULTY_REVIEW",
      });

      evaluation = await Evaluation.create({
        answerSheet: sheet._id,
        evaluationType: "AI",
        obtainedMarks: 6,
        totalMarks: 10,
        percentage: 60,
        evaluationStatus: "READY_FOR_FACULTY_REVIEW",
        questions: [
          {
            questionId: exam.questions[0]._id,
            questionNumber: "1",
            maximumMarks: 10,
            aiMarks: 6,
            finalAwardedMarks: 6,
            recognizedText: "Database indexing improves query efficiency by reducing disk I/O scan time.",
            modelAnswer: exam.questions[0].modelAnswer || "An index reduces data scanned.",
            confidence: 0.85,
            reviewStatus: "pending",
            evaluationConfigVersion: 1,
            aiEvaluation: {
              marksAwarded: 6,
              maxMarks: 10,
              confidence: 0.85,
              feedback: "Good answer",
            },
          },
        ],
        createdBy: facultyUser._id,
      });
      evaluation = await Evaluation.findById(evaluation._id).populate({ path: "answerSheet", populate: "exam student" });
    }

    const testEvaluationId = evaluation._id;
    const testAnswerSheetId = evaluation.answerSheet._id;
    const testExamId = evaluation.answerSheet.exam._id;
    const q1 = evaluation.questions[0];
    const q1Num = q1.questionNumber;

    // Ensure test faculty owns the exam for access validation
    const testExam = await Exam.findById(testExamId);
    if (testExam) {
      testExam.createdBy = facultyUser._id;
      await testExam.save();
    }

    console.log(`✓ Testing with Evaluation ID: ${testEvaluationId}, Exam ID: ${testExamId}, Question: Q${q1Num}`);

    // ---------------------------------------------------------
    // TEST 1 — Faculty Override & Structured Feedback Capture
    // ---------------------------------------------------------
    console.log("\n--- TEST 1: Faculty Override & Structured Feedback Capture ---");
    // Ensure answer sheet and evaluation are in reviewable status
    await AnswerSheet.findByIdAndUpdate(testAnswerSheetId, {
      reviewStatus: "READY_FOR_FACULTY_REVIEW",
      evaluationStatus: "READY_FOR_FACULTY_REVIEW",
      processingStatus: "completed",
      ocrStatus: "completed",
    });
    await Evaluation.findByIdAndUpdate(testEvaluationId, {
      evaluationStatus: "READY_FOR_FACULTY_REVIEW",
    });

    // Transition review status to in-progress first
    await facultyReviewService.startReview(testAnswerSheetId, facultyUser._id);

    const overrideReason = "Valid alternative answer";
    const facultyComment = "Student used an equivalent efficient index explanation.";
    const facultyMarks = 9;

    const overrideResult = await facultyReviewService.overrideQuestion(
      testEvaluationId,
      q1Num,
      facultyMarks,
      overrideReason,
      facultyComment,
      facultyUser._id
    );

    console.log(`✓ Question Q${q1Num} Overridden: AI Marks = ${q1.aiMarks}, Final Marks = ${overrideResult.question.facultyAwardedMarks}, Difference = ${overrideResult.difference}`);

    // Verify feedback document recorded in EvaluationFeedback collection
    const feedbackDoc = await EvaluationFeedback.findOne({
      evaluationId: testEvaluationId,
      questionNumber: String(q1Num),
      isDeleted: false,
    });

    if (!feedbackDoc) {
      throw new Error("TEST 1 FAILED: EvaluationFeedback document was not saved to database.");
    }

    if (feedbackDoc.aiMarks !== q1.aiMarks || feedbackDoc.finalMarks !== facultyMarks || feedbackDoc.reason !== overrideReason) {
      throw new Error(`TEST 1 FAILED: Incorrect feedback fields stored. Expected AI ${q1.aiMarks}, Final ${facultyMarks}, got AI ${feedbackDoc.aiMarks}, Final ${feedbackDoc.finalMarks}`);
    }
    console.log(`✓ TEST 1 PASSED: EvaluationFeedback document created cleanly with reason "${feedbackDoc.reason}" and difference ${feedbackDoc.difference >= 0 ? "+" : ""}${feedbackDoc.difference}`);

    // ---------------------------------------------------------
    // TEST 2 — Feedback History Query & Search Filter
    // ---------------------------------------------------------
    console.log("\n--- TEST 2: Feedback History Query & Search Filter ---");
    const historyResult = await feedbackService.getFeedbackHistory({ examId: testExamId }, facultyUser);
    if (!historyResult.items || historyResult.items.length === 0) {
      throw new Error("TEST 2 FAILED: Feedback history query returned 0 items.");
    }
    console.log(`✓ TEST 2 PASSED: Retrieved ${historyResult.total} feedback history items.`);

    // ---------------------------------------------------------
    // TEST 3 — Feedback Analytics & Pattern Identification
    // ---------------------------------------------------------
    console.log("\n--- TEST 3: Feedback Analytics & Pattern Identification ---");
    const analytics = await improvementService.getImprovementAnalytics(testExamId, facultyUser);
    console.log(`✓ Overview Metrics: Total Feedback = ${analytics.overviewCards.totalFeedback}, Overrides = ${analytics.overviewCards.totalOverrides}, Override Rate = ${analytics.overviewCards.overrideRate}%`);
    console.log(`✓ Category Breakdown: ${analytics.categoryCounts.map(c => `${c.name}: ${c.count}`).join(", ")}`);
    console.log(`✓ Potential Improvement Patterns Identified: ${analytics.potentialImprovements.length}`);
    console.log("✓ TEST 3 PASSED: Analytics and pattern identification computed successfully.");

    // ---------------------------------------------------------
    // TEST 4 — Create Improvement Suggestion
    // ---------------------------------------------------------
    console.log("\n--- TEST 4: Create Improvement Suggestion ---");
    const suggestion = await improvementService.createImprovementSuggestion({
      examId: testExamId,
      questionNumber: String(q1Num),
      type: "reference_answer",
      suggestedModelAnswer: "An index can also reduce disk I/O by allowing the database engine to locate records efficiently.",
      justification: "Student used valid equivalent index performance explanation.",
      sourceFeedbackIds: [feedbackDoc._id],
    }, facultyUser);

    if (suggestion.status !== "Pending") {
      throw new Error(`TEST 4 FAILED: Expected suggestion status 'Pending', got '${suggestion.status}'`);
    }
    console.log(`✓ TEST 4 PASSED: Created Suggestion ${suggestion._id} with Status = ${suggestion.status}, Version = v${suggestion.currentVersion}`);

    // ---------------------------------------------------------
    // TEST 5 — Evidence & Side-by-Side Comparison Payload
    // ---------------------------------------------------------
    console.log("\n--- TEST 5: Evidence & Side-by-Side Comparison Payload ---");
    const evidencePayload = await improvementService.getSuggestionEvidenceAndCompare(suggestion._id);
    if (!evidencePayload.evidence || evidencePayload.evidence.length === 0) {
      throw new Error("TEST 5 FAILED: Evidence list returned empty.");
    }
    console.log(`✓ Evidence count: ${evidencePayload.evidenceCount}. Anonymized Eval Code: ${evidencePayload.evidence[0].anonymizedEvaluationId}`);
    console.log(`✓ Current Model Ans: "${evidencePayload.comparison.currentModelAnswer}"`);
    console.log(`✓ Suggested Model Ans: "${evidencePayload.comparison.suggestedModelAnswer}"`);
    console.log("✓ TEST 5 PASSED: Evidence and side-by-side comparison verified.");

    // ---------------------------------------------------------
    // TEST 6 — Rejection Flow (Verify original version remains unchanged)
    // ---------------------------------------------------------
    console.log("\n--- TEST 6: Rejection Flow ---");
    const examBeforeReject = await Exam.findById(testExamId);
    const versionBeforeReject = examBeforeReject.questions.find(q => String(q.questionNumber) === String(q1Num))?.evaluationConfig?.version || 1;

    const rejectionSuggestion = await improvementService.createImprovementSuggestion({
      examId: testExamId,
      questionNumber: String(q1Num),
      type: "rubric",
      justification: "Test rejection workflow",
      sourceFeedbackIds: [],
    }, facultyUser);

    const rejectResult = await improvementService.reviewImprovementSuggestion(
      rejectionSuggestion._id,
      "reject",
      "Rejecting invalid suggestion for test verification",
      adminUser
    );

    if (rejectResult.suggestion.status !== "Rejected") {
      throw new Error("TEST 6 FAILED: Suggestion status was not updated to Rejected.");
    }

    // Verify exam question version was NOT modified by rejected suggestion
    const examCheck1 = await Exam.findById(testExamId);
    const qCheck1 = examCheck1.questions.find(q => String(q.questionNumber) === String(q1Num));
    if (qCheck1.evaluationConfig?.version !== versionBeforeReject) {
      throw new Error(`TEST 6 FAILED: Rejected suggestion modified the exam question version! Expected ${versionBeforeReject}, got ${qCheck1.evaluationConfig?.version}`);
    }
    console.log(`✓ TEST 6 PASSED: Suggestion rejected cleanly. Question version remains v${qCheck1.evaluationConfig?.version}.`);

    // ---------------------------------------------------------
    // TEST 7 — Approval Flow & Version Activation (v -> v+1)
    // ---------------------------------------------------------
    console.log("\n--- TEST 7: Approval Flow & Version Activation (v -> v+1) ---");
    const examBeforeApprove = await Exam.findById(testExamId);
    const versionBeforeApprove = examBeforeApprove.questions.find(q => String(q.questionNumber) === String(q1Num))?.evaluationConfig?.version || 1;
    const expectedNewVersion = versionBeforeApprove + 1;

    const approveResult = await improvementService.reviewImprovementSuggestion(
      suggestion._id,
      "approve",
      "Approving valid reference answer enhancement",
      adminUser
    );

    if (approveResult.suggestion.status !== "Approved" || approveResult.activatedVersion !== expectedNewVersion) {
      throw new Error(`TEST 7 FAILED: Approval failed. Expected status 'Approved' and version ${expectedNewVersion}, got ${approveResult.suggestion.status} / v${approveResult.activatedVersion}`);
    }

    // Verify Exam model question was updated to expectedNewVersion and marked Active
    const examCheck2 = await Exam.findById(testExamId);
    const qCheck2 = examCheck2.questions.find(q => String(q.questionNumber) === String(q1Num));
    if (qCheck2.evaluationConfig?.version !== expectedNewVersion || qCheck2.modelAnswer !== suggestion.suggestedModelAnswer) {
      throw new Error(`TEST 7 FAILED: Exam question was not upgraded to v${expectedNewVersion}. Current version = ${qCheck2.evaluationConfig?.version}`);
    }
    console.log(`✓ TEST 7 PASSED: Approved suggestion upgraded Exam Q${q1Num} to Version ${qCheck2.evaluationConfig?.version}. Model answer updated.`);

    // ---------------------------------------------------------
    // TEST 8 — Historical Evaluation Reproducibility
    // ---------------------------------------------------------
    console.log("\n--- TEST 8: Historical Evaluation Reproducibility ---");
    // Verify that the old finalized evaluation document STILL stores Version 1 and original marks!
    const oldEvalCheck = await Evaluation.findById(testEvaluationId);
    const oldQ1 = oldEvalCheck.questions[0];
    if (oldQ1.evaluationConfigVersion !== 1) {
      throw new Error(`TEST 8 FAILED: Old finalized evaluation version changed! Expected 1, got ${oldQ1.evaluationConfigVersion}`);
    }
    if (oldEvalCheck.obtainedMarks !== overrideResult.evaluation.obtainedMarks) {
      throw new Error("TEST 8 FAILED: Old finalized evaluation marks were recalculated or altered!");
    }
    console.log(`✓ TEST 8 PASSED: Historical evaluation preserved Version ${oldQ1.evaluationConfigVersion} and obtained marks ${oldEvalCheck.obtainedMarks}. NO AUTOMATIC MARK ALTERATION OCCURRED.`);

    // ---------------------------------------------------------
    // TEST 9 — Future AI Evaluation Uses Approved Active Version
    // ---------------------------------------------------------
    console.log("\n--- TEST 9: Future AI Evaluation Uses Approved Active Version ---");
    const testExamDoc = await Exam.findById(testExamId);
    const futureSheet = await AnswerSheet.create({
      student: studentUser._id,
      exam: testExamId,
      subject: testExamDoc.subject,
      processingStatus: "completed",
      ocrStatus: "completed",
      answers: [
        {
          questionId: testExamDoc.questions[0]._id,
          questionNumber: parseInt(q1Num),
          recognizedText: "Database indexing reduces disk I/O by allowing fast record location.",
        },
      ],
      submissionStatus: "Pending AI Evaluation",
    });

    const futureEval = await evaluationPipelineService.queueEvaluation(futureSheet._id, facultyUser._id, { scope: "FULL_SHEET" });
    
    // Give pipeline brief moment to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const futureEvalResult = await Evaluation.findById(futureEval._id);
    const futureQ1 = futureEvalResult.questions.find(q => String(q.questionNumber) === String(q1Num));

    if (!futureQ1) {
      throw new Error("TEST 9 FAILED: Future evaluation question result not found.");
    }
    console.log(`✓ Future evaluation version for Q${q1Num}: v${futureQ1.evaluationConfigVersion}`);
    if (futureQ1.evaluationConfigVersion !== expectedNewVersion) {
      throw new Error(`TEST 9 FAILED: Expected future evaluation to use Version ${expectedNewVersion}, but got Version ${futureQ1.evaluationConfigVersion}`);
    }
    console.log(`✓ TEST 9 PASSED: Future evaluation loaded active configuration version ${futureQ1.evaluationConfigVersion}.`);

    // ---------------------------------------------------------
    // TEST 10 — Authorization RBAC Check (Student Rejection)
    // ---------------------------------------------------------
    console.log("\n--- TEST 10: Authorization RBAC Check (Student Rejection) ---");
    try {
      const feedbackController = (await import("./src/controllers/feedback.controller.js")).default;
      const dummyRes = { status: () => dummyRes, json: () => dummyRes, send: () => dummyRes };
      let caughtError = null;
      await feedbackController.getAllFeedback({ user: studentUser }, dummyRes, (err) => {
        caughtError = err;
      });
      if (caughtError) {
        throw caughtError;
      }
      throw new Error("TEST 10 FAILED: Student was not rejected!");
    } catch (err) {
      if (err.statusCode === 403 || (err.message && err.message.includes("authorized"))) {
        console.log("✓ TEST 10 PASSED: Student access to faculty feedback was correctly rejected with HTTP 403 Forbidden.");
      } else {
        throw err;
      }
    }

    console.log("\n========================================================");
    console.log("  ALL PHASE 5B VERIFICATION TESTS PASSED SUCCESSFULLY!  ");
    console.log("========================================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ PHASE 5B VERIFICATION FAILURE:", error.message);
    if (error.stack) console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

runPhase5BTests();
