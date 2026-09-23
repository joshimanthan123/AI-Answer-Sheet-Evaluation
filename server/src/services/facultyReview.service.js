import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import evaluationValidator from "../utils/evaluationValidator.js";
import gradingService from "./ai/grading.service.js";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";
import logger from "../utils/logger.js";

/**
 * Validates whether the faculty member owns the exam associated with the answer sheet.
 * Admins are automatically authorized.
 * @param {object} answerSheet The AnswerSheet document.
 * @param {string} userId The Authenticated User ID.
 * @throws {ApiError} Triggers 403 Forbidden or 404 Not Found as appropriate.
 */
export const validateAccess = async (answerSheet, userId) => {
  if (!answerSheet.exam) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer sheet is not associated with an exam.");
  }

  const exam = await Exam.findById(answerSheet.exam);
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "User not found.");
  }

  if (user.role === "admin") {
    return exam; // Admins have global permission
  }

  if (user.role === "faculty") {
    if (exam.createdBy && exam.createdBy.toString() === userId.toString()) {
      return exam;
    }
  }

  throw new ApiError(STATUS_CODES.FORBIDDEN, "Faculty member is not authorized to review this answer sheet.");
};

/**
 * Retrieves the faculty review queue based on filters and authorization.
 * @param {object} filters Criteria filters: status, examId, studentId, page, limit.
 * @param {string} userId Faculty member user identifier.
 * @returns {object} paginated result set with summaries of review items.
 */
export const getReviewQueue = async (filters = {}, userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "User not found");
  }

  const mongoQuery = { isDeleted: false };

  // Authorization check on exam ownership
  if (user.role !== "admin") {
    const exams = await Exam.find({ createdBy: userId, isDeleted: false });
    const examIds = exams.map((e) => e._id);
    mongoQuery.exam = { $in: examIds };
  }

  // Filter apply overrides
  if (filters.examId) {
    if (mongoQuery.exam) {
      const allowedIds = mongoQuery.exam.$in.map((id) => id.toString());
      if (allowedIds.includes(filters.examId.toString())) {
        mongoQuery.exam = filters.examId;
      } else {
        return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      }
    } else {
      mongoQuery.exam = filters.examId;
    }
  }

  if (filters.studentId) {
    mongoQuery.student = filters.studentId;
  }

  if (filters.status) {
    mongoQuery.reviewStatus = filters.status;
  } else {
    // Include all submitted answer sheets ready or pending review
    mongoQuery.$or = [
      { reviewStatus: { $in: ["READY_FOR_FACULTY_REVIEW", "FACULTY_REVIEW_IN_PROGRESS", "REVISION_REQUIRED"] } },
      { submissionStatus: { $in: ["Submitted", "Pending AI Evaluation", "Faculty Review"] } }
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await AnswerSheet.countDocuments(mongoQuery);
  const answerSheets = await AnswerSheet.find(mongoQuery)
    .sort("-updatedAt")
    .skip(skip)
    .limit(limit)
    .populate("student", "name email rollNo department")
    .populate("exam", "title totalMarks");

  const sheetIds = answerSheets.map((as) => as._id);
  const evaluations = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: false,
  }).select("answerSheet questions").lean();

  const evalMap = new Map();
  evaluations.forEach((ev) => {
    if (ev.answerSheet) {
      evalMap.set(ev.answerSheet.toString(), ev);
    }
  });

  const data = answerSheets.map((as) => {
    const evaluation = evalMap.get(as._id.toString());
    let lowConfidenceWarningCount = 0;
    if (evaluation && evaluation.questions) {
      lowConfidenceWarningCount = evaluation.questions.filter((q) => {
        const hasLowConf = q.confidence !== undefined && q.confidence < 0.7;
        const hasLowConfWarning =
          q.warnings &&
          q.warnings.some((w) => w.code && w.code.includes("CONFIDENCE"));
        return hasLowConf || hasLowConfWarning;
      }).length;
    }

    return {
      answerSheetId: as._id,
      student: as.student
        ? {
            id: as.student._id,
            name: as.student.name,
            email: as.student.email,
            rollNo: as.student.rollNo,
            department: as.student.department,
          }
        : null,
      exam: as.exam
        ? {
            id: as.exam._id,
            title: as.exam.title,
            totalMarks: as.exam.totalMarks,
          }
        : null,
      evaluationStatus: as.evaluationStatus,
      reviewStatus: as.reviewStatus,
      totalAwardedMarks: as.evaluationSummary?.totalAwardedMarks || 0,
      totalMaximumMarks: as.evaluationSummary?.totalMaximumMarks || 0,
      percentage: as.evaluationSummary?.percentage || 0,
      lowConfidenceWarningCount,
      evaluationCompletedAt: as.evaluationCompletedAt || as.updatedAt,
    };
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Retrieves the complete detailed structure required to review an answer sheet.
 * @param {string} answerSheetId The AnswerSheet ID.
 * @param {string} userId Authenticated faculty ID.
 * @returns {object} Detail package with student info, exam info, HWR OCR and evaluations.
 */
export const getReviewDetails = async (answerSheetId, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false })
    .populate("student", "name email rollNo department semester")
    .populate("exam", "title totalMarks duration questions")
    .populate("subject", "name code semester");

  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found for this answer sheet.");
  }

  return {
    answerSheet: ansSheet,
    evaluation,
  };
};

/**
 * Starts faculty review. Transition: reviewStatus -> FACULTY_REVIEW_IN_PROGRESS.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} userId Faculty member user ID.
 */
export const startReview = async (answerSheetId, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  // Status check: Cannot start review if AI evaluation failed or OCR failed
  if (
    ansSheet.evaluationStatus === "EVALUATION_FAILED" ||
    ansSheet.ocrStatus === "failed" ||
    ansSheet.processingStatus === "failed"
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "CANNOT_REVIEW_FAILED_EVALUATION: Evaluation or OCR failed for this answer sheet.");
  }

  // Status check: Cannot start review unless AI evaluation has run (ready or completed)
  if (
    ansSheet.evaluationStatus !== "READY_FOR_FACULTY_REVIEW" &&
    ansSheet.evaluationStatus !== "EVALUATION_COMPLETED" &&
    ansSheet.evaluationStatus !== "PARTIALLY_EVALUATED"
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation has not completed or is running.");
  }

  // Prevent conflicting review start
  if (ansSheet.reviewStatus === "FACULTY_REVIEW_IN_PROGRESS" && ansSheet.reviewedBy && ansSheet.reviewedBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.CONFLICT, "Another faculty member is already reviewing this answer sheet.");
  }

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot start review on a finalized evaluation.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  // Verify same submission binding
  if (evaluation.answerSheet.toString() !== answerSheetId.toString()) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "EVALUATION_SUBMISSION_MISMATCH: Evaluation does not belong to this submission.");
  }

  if (evaluation.evaluationStatus === "EVALUATION_FAILED" || evaluation.evaluationStatus === "FAILED" || evaluation.evaluationStatus === "failed") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "CANNOT_REVIEW_FAILED_EVALUATION: Evaluation failed for this submission.");
  }

  // If already in progress by current user, just return status
  if (ansSheet.reviewStatus === "FACULTY_REVIEW_IN_PROGRESS" && ansSheet.reviewedBy && ansSheet.reviewedBy.toString() === userId.toString()) {
    return { answerSheet: ansSheet, evaluation };
  }

  // Perform status update
  ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
  ansSheet.reviewedBy = userId;
  ansSheet.reviewStartedAt = new Date();
  await ansSheet.save();

  evaluation.reviewedBy = userId;
  evaluation.reviewStartedAt = new Date();
  
  // Append audit trail log
  evaluation.auditHistory.push({
    action: "REVIEW_STARTED",
    changedBy: userId,
    comment: "Faculty member started the manual review process.",
  });
  await evaluation.save();

  logger.info(`Faculty ${userId} started review for AnswerSheet ${answerSheetId}`);
  return { answerSheet: ansSheet, evaluation };
};

/**
 * Saves review for a specific question. Updates overrides.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} questionNumber Identifier of the question (e.g. "Q1" or questionNumber relative idx).
 * @param {number} facultyMarks Overridden score.
 * @param {string} comment Reason/justification comment.
 * @param {string} userId Faculty member user ID.
 */
export const reviewQuestion = async (answerSheetId, questionNumber, facultyMarks, comment, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  // State constraint verification
  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Review has been finalized and cannot be modified.");
  }

  if (ansSheet.reviewStatus !== "FACULTY_REVIEW_IN_PROGRESS") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Review must be inside FACULTY_REVIEW_IN_PROGRESS status to modify marks.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false }).populate({
    path: "answerSheet",
    populate: "exam",
  });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  // Lookup the target question inside Evaluation question set
  const examQuestions = evaluation.answerSheet?.exam?.questions || [];
  // Parse questionNumber. Support both numeric (1, 2) and string codes ("Q1", "1")
  const numericQNum = parseInt(questionNumber.replace(/[^\d]/g, ""));
  const targetExamQ = examQuestions.find(eq => eq.questionNumber === numericQNum);
  
  if (!targetExamQ) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question ${questionNumber} not found in the associated exam layout.`);
  }

  const qEval = evaluation.questions.find(
    q => q.questionId.toString() === targetExamQ._id.toString()
  );

  if (!qEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `AI evaluation details for Question ${questionNumber} do not exist.`);
  }

  // Validate marks boundaries
  const maxQMarks = targetExamQ.maximumMarks || 10;
  if (facultyMarks === null || facultyMarks === undefined || isNaN(facultyMarks)) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Provide a valid override mark.");
  }

  if (facultyMarks < 0 || facultyMarks > maxQMarks) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Marks override must be in range 0 - ${maxQMarks}.`);
  }

  // Preserve previous value details for audit
  const previousMarks = qEval.facultyAwardedMarks !== undefined ? qEval.facultyAwardedMarks : null;
  const previousComment = qEval.facultyComment || null;

  // Store faculty values
  qEval.facultyAwardedMarks = facultyMarks;
  qEval.wasOverridden = true;
  qEval.overrideReason = comment || "No justification provided.";
  qEval.facultyComment = comment || "";
  
  // Calculate finalAwardedMarks rule
  qEval.finalAwardedMarks = facultyMarks;

  // Append audit trail log
  evaluation.auditHistory.push({
    action: "MARK_OVERRIDDEN",
    questionNumber: `Q${targetExamQ.questionNumber}`,
    previousValue: { marks: previousMarks, comment: previousComment },
    newValue: { marks: facultyMarks, comment },
    comment: comment || "Mark override saved.",
    changedBy: userId,
  });

  // Re-run totals calculation
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  await evaluation.save();

  // Save totals back to AnswerSheet
  ansSheet.evaluationSummary = summary;
  await ansSheet.save();

  logger.info(`Question ${questionNumber} manually updated by faculty ${userId}. Final Awarded Marks: ${facultyMarks}`);
  return { answerSheet: ansSheet, evaluation };
};

/**
 * Adds an overall feedback comment to the evaluation sheet.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} comment Feedback content.
 * @param {string} userId Faculty ID.
 */
export const addOverallComment = async (answerSheetId, comment, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation review is finalized.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  const previousComment = evaluation.overallComment || null;
  evaluation.overallComment = comment;

  evaluation.auditHistory.push({
    action: "COMMENT_ADDED",
    previousValue: { overallComment: previousComment },
    newValue: { overallComment: comment },
    comment: "Overall evaluation comments updated.",
    changedBy: userId,
  });

  await evaluation.save();
  return { answerSheet: ansSheet, evaluation };
};

/**
 * Submits AI re-evaluation request, triggering the underlying Phase 5 queue logic.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} scope EVALUATION scope: FULL_SHEET or QUESTION.
 * @param {string} questionNumber Question code.
 * @param {string} reason Faculty recheck justification.
 * @param {string} userId Faculty ID.
 */
export const requestReEvaluation = async (answerSheetId, scope, questionNumber = null, reason = "", userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  const exam = await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Assessment is finalized and cannot spawn re-evaluations.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found.");
  }

  // Capture original result to log into audit trail
  const summaryBefore = { ...ansSheet.evaluationSummary };

  // Append recheck request to audit
  evaluation.auditHistory.push({
    action: "RE_EVALUATION_REQUESTED",
    questionNumber,
    comment: `AI Re-evaluation requested for scope [${scope}]. Reason: ${reason || "None"}`,
    changedBy: userId,
  });
  await evaluation.save();

  // Reset the review status to READY_FOR_FACULTY_REVIEW because the recheck starts
  ansSheet.reviewStatus = "READY_FOR_FACULTY_REVIEW";
  await ansSheet.save();

  try {
    if (scope === "QUESTION") {
      if (!questionNumber) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Question number is required for QUESTION scope.");
      }
      
      const qNum = parseInt(questionNumber.replace(/[^\d]/g, ""));
      const matchQ = exam.questions.find(eq => eq.questionNumber === qNum);
      if (!matchQ) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, `Question ${questionNumber} not found.`);
      }
      
      // Async call from evaluationPipelineService
      await evaluationPipelineService.queueEvaluation(answerSheetId, userId, {
        scope: "QUESTION",
        questionNumber: questionNumber,
        reEvaluate: true,
      });

    } else {
      // FULL_SHEET recheck
      await evaluationPipelineService.queueEvaluation(answerSheetId, userId, {
        scope: "FULL_SHEET",
        reEvaluate: true,
      });
    }
  } catch (err) {
    logger.error(`Re-evaluation run failed: ${err.message}. Preserving previous marks state.`);
    // Restore primary status and totals as per prompt: "A failed re-evaluation must not destroy previously valid AI results."
    ansSheet.evaluationSummary = summaryBefore;
    ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
    await ansSheet.save();
    throw err;
  }

  return { answerSheet: ansSheet, evaluation };
};

/**
 * Transitions reviewStatus to REVISION_REQUIRED.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} reason Change description.
 * @param {string} userId Faculty ID.
 */
export const requestRevision = async (answerSheetId, reason, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot update status on a finalized evaluation.");
  }

  if (ansSheet.reviewStatus !== "FACULTY_REVIEW_IN_PROGRESS") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Can only transition to REVISION_REQUIRED from FACULTY_REVIEW_IN_PROGRESS.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  ansSheet.reviewStatus = "REVISION_REQUIRED";
  await ansSheet.save();

  evaluation.auditHistory.push({
    action: "REVISION_REQUESTED",
    comment: `Revision requested. Reason: ${reason || "None"}`,
    changedBy: userId,
  });
  await evaluation.save();

  logger.info(`Revision requested by ${userId} for AnswerSheet ${answerSheetId}. status: REVISION_REQUIRED`);
  return { answerSheet: ansSheet, evaluation };
};

/**
 * Transitions reviewStatus to APPROVED. Recalculates final marks.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} userId Faculty ID.
 */
export const approveReview = async (answerSheetId, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Review has already been finalized.");
  }

  if (ansSheet.reviewStatus !== "FACULTY_REVIEW_IN_PROGRESS" && ansSheet.reviewStatus !== "READY_FOR_FACULTY_REVIEW") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Can only approve reviews that are in progress or ready.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  // Verify same submission binding
  if (evaluation.answerSheet.toString() !== answerSheetId.toString()) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "EVALUATION_SUBMISSION_MISMATCH: Evaluation does not belong to this submission.");
  }

  if (
    ansSheet.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "FAILED" ||
    evaluation.evaluationStatus === "failed"
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "CANNOT_APPROVE_FAILED_EVALUATION: Cannot approve evaluation that failed or was not completed.");
  }

  // Final totals verify and save
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);

  ansSheet.reviewStatus = "APPROVED";
  ansSheet.reviewedAt = new Date();
  ansSheet.reviewedBy = userId;
  ansSheet.evaluationSummary = summary;
  await ansSheet.save();

  evaluation.reviewedAt = new Date();
  evaluation.reviewedBy = userId;
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  evaluation.auditHistory.push({
    action: "REVIEW_APPROVED",
    comment: "Marks review approved by faculty member.",
    changedBy: userId,
  });
  await evaluation.save();

  logger.info(`Faculty ${userId} approved evaluation for AnswerSheet ${answerSheetId}`);
  return { answerSheet: ansSheet, evaluation };
};

/**
 * Locks the review permanently. Transition: APPROVED -> FINALIZED.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} userId Faculty ID.
 */
export const finalizeReview = async (answerSheetId, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.CONFLICT, "Review has already been finalized.");
  }

  if (ansSheet.reviewStatus !== "APPROVED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation review must be APPROVED before finalization.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found.");
  }

  // Verify same submission binding
  if (evaluation.answerSheet.toString() !== answerSheetId.toString()) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "EVALUATION_SUBMISSION_MISMATCH: Evaluation does not belong to this submission.");
  }

  if (
    ansSheet.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "FAILED" ||
    evaluation.evaluationStatus === "failed"
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "CANNOT_FINALIZE_FAILED_EVALUATION: Cannot finalize evaluation that failed or was not completed.");
  }

  // Recalculate and validate totals
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);

  ansSheet.reviewStatus = "FINALIZED";
  ansSheet.finalizedAt = new Date();
  ansSheet.finalizedBy = userId;
  ansSheet.evaluationSummary = summary;
  
  // Initialize resultPublication status
  ansSheet.resultPublication = {
    status: "READY_FOR_RESULT_PUBLICATION",
    publishedAt: null,
    publishedBy: null,
    unpublishedAt: null,
    unpublishedBy: null,
    publicationComment: null
  };
  
  // Seal student submission status to publish readiness
  ansSheet.submissionStatus = "Completed";
  await ansSheet.save();

  evaluation.finalizedAt = new Date();
  evaluation.finalizedBy = userId;
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  // Set the legacy text status for backward compatibility if any queries look for it
  evaluation.evaluationStatus = "finalized";

  evaluation.auditHistory.push({
    action: "EVALUATION_FINALIZED",
    comment: "Evaluation locked and finalized. Marks sealed.",
    changedBy: userId,
  });
  await evaluation.save();

  logger.info(`Faculty ${userId} finalized evaluation for AnswerSheet ${answerSheetId}`);
  return { answerSheet: ansSheet, evaluation };
};

export const PREDEFINED_OVERRIDE_REASONS = [
  "AI underestimated answer",
  "AI overestimated answer",
  "OCR error",
  "Valid alternative answer",
  "Partial concept accepted",
  "Reference answer mismatch",
  "Correct concept with different wording",
  "Student answer deserves additional marks",
  "Student answer deserves fewer marks",
  "Other"
];

/**
 * Resolves Evaluation and AnswerSheet by either evaluationId or answerSheetId.
 */
export const resolveEvaluationAndSheet = async (id) => {
  let evaluation = await Evaluation.findOne({ _id: id, isDeleted: false }).populate({
    path: "answerSheet",
    populate: "exam student subject",
  });
  let ansSheet;
  if (evaluation) {
    ansSheet = evaluation.answerSheet;
  } else {
    ansSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false }).populate("exam student subject");
    if (!ansSheet) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation or Answer sheet not found.");
    }
    evaluation = await Evaluation.findOne({ answerSheet: ansSheet._id, isDeleted: false });
  }
  return { evaluation, ansSheet };
};

/**
 * Finds target question subdocument inside Evaluation by questionId or questionNumber.
 */

const findQuestionInEvaluation = (evaluation, questionIdOrNum) => {
  if (!evaluation || !evaluation.questions) return null;
  const targetStr = String(questionIdOrNum).trim();
  const numericQNum = parseInt(targetStr.replace(/[^\d]/g, ""));

  return evaluation.questions.find((q) => {
    if (q._id && q._id.toString() === targetStr) return true;
    if (q.questionId && q.questionId.toString() === targetStr) return true;
    if (q.questionNumber !== undefined && q.questionNumber !== null) {
      if (String(q.questionNumber).trim() === targetStr) return true;
      if (!isNaN(numericQNum) && parseInt(String(q.questionNumber).replace(/[^\d]/g, "")) === numericQNum) return true;
      if (`Q${q.questionNumber}`.toUpperCase() === targetStr.toUpperCase()) return true;
    }
    return false;
  });
};

/**
 * Accepts AI marks for a specific question. Preserves original AI evaluation intact.
 */
export const acceptAiQuestion = async (id, questionIdOrNum, userId) => {
  const { evaluation, ansSheet } = await resolveEvaluationAndSheet(id);
  if (!evaluation || !ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED" || evaluation.evaluationStatus === "finalized") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation review is finalized and locked.");
  }

  const qEval = findQuestionInEvaluation(evaluation, questionIdOrNum);
  if (!qEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question ${questionIdOrNum} not found in evaluation.`);
  }

  if (qEval.reviewStatus === "finalized") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Question ${qEval.questionNumber} is finalized and locked.`);
  }

  const aiMarks = qEval.aiEvaluation?.marksAwarded ?? qEval.aiMarks ?? 0;
  
  // Set faculty values = AI values (Accept AI)
  qEval.facultyAwardedMarks = aiMarks;
  qEval.facultyMarks = aiMarks;
  qEval.finalAwardedMarks = aiMarks;
  qEval.wasOverridden = false;
  qEval.overrideReason = "";
  qEval.facultyComment = qEval.facultyComment || "Accepted AI evaluation";
  qEval.reviewType = "accepted";
  qEval.reviewStatus = "reviewed";

  qEval.facultyEvaluation = {
    status: "accepted",
    reviewType: "accepted",
    finalMarks: aiMarks,
    overrideReason: "",
    comment: qEval.facultyComment,
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  evaluation.auditHistory.push({
    action: "AI_ACCEPTED",
    questionNumber: `Q${qEval.questionNumber}`,
    previousValue: { marks: qEval.aiMarks },
    newValue: { marks: aiMarks, reviewType: "accepted" },
    comment: "Faculty accepted AI evaluation marks.",
    changedBy: userId,
  });

  // Recalculate evaluation totals
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  await evaluation.save();

  ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
  ansSheet.evaluationSummary = summary;
  await ansSheet.save();

  return { evaluation, ansSheet, question: qEval };
};

/**
 * Overrides AI marks for a specific question with reason, comment, and range validation.
 */
export const overrideQuestion = async (id, questionIdOrNum, facultyMarks, overrideReason, comment, userId) => {
  const { evaluation, ansSheet } = await resolveEvaluationAndSheet(id);
  if (!evaluation || !ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED" || evaluation.evaluationStatus === "finalized") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation review is finalized and locked.");
  }

  const qEval = findQuestionInEvaluation(evaluation, questionIdOrNum);
  if (!qEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question ${questionIdOrNum} not found in evaluation.`);
  }

  if (qEval.reviewStatus === "finalized") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Question ${qEval.questionNumber} is finalized and locked.`);
  }

  const maxMarks = qEval.maxMarks || qEval.aiEvaluation?.maxMarks || 10;
  
  // Marks validation
  if (facultyMarks === null || facultyMarks === undefined || isNaN(facultyMarks)) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Please provide valid numeric faculty marks.");
  }

  if (facultyMarks < 0 || facultyMarks > maxMarks) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Faculty marks must be between 0 and ${maxMarks}.`);
  }

  // Override reason validation
  if (!overrideReason || typeof overrideReason !== "string" || !overrideReason.trim()) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Valid override reason must be provided.");
  }

  const trimmedReason = overrideReason.trim();
  if (!PREDEFINED_OVERRIDE_REASONS.includes(trimmedReason)) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Selected override reason is invalid.");
  }

  if (trimmedReason === "Other" && (!comment || typeof comment !== "string" || !comment.trim())) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Faculty comment is required when reason is 'Other'.");
  }

  const finalComment = comment ? comment.trim() : trimmedReason;
  const aiMarks = qEval.aiEvaluation?.marksAwarded ?? qEval.aiMarks ?? 0;
  const difference = facultyMarks - aiMarks;

  const previousMarks = qEval.facultyAwardedMarks !== undefined ? qEval.facultyAwardedMarks : aiMarks;

  qEval.facultyAwardedMarks = facultyMarks;
  qEval.facultyMarks = facultyMarks;
  qEval.finalAwardedMarks = facultyMarks;
  qEval.wasOverridden = true;
  qEval.overrideReason = trimmedReason;
  qEval.facultyComment = finalComment;
  qEval.reviewType = "overridden";
  qEval.reviewStatus = "reviewed";

  qEval.facultyEvaluation = {
    status: "modified",
    reviewType: "overridden",
    finalMarks: facultyMarks,
    overrideReason: trimmedReason,
    comment: finalComment,
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  evaluation.auditHistory.push({
    action: "MARK_OVERRIDDEN",
    questionNumber: `Q${qEval.questionNumber}`,
    previousValue: { marks: previousMarks },
    newValue: { marks: facultyMarks, difference, overrideReason: trimmedReason, comment: finalComment },
    comment: `Faculty overridden Q${qEval.questionNumber}: ${trimmedReason}`,
    changedBy: userId,
  });

  // Recalculate totals
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  await evaluation.save();

  ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
  ansSheet.evaluationSummary = summary;
  await ansSheet.save();

  return { evaluation, ansSheet, question: qEval, difference };
};

/**
 * Finalizes a single question in an evaluation. Locks question from further editing.
 */
export const finalizeSingleQuestion = async (id, questionIdOrNum, userId) => {
  const { evaluation, ansSheet } = await resolveEvaluationAndSheet(id);
  if (!evaluation || !ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found.");
  }

  await validateAccess(ansSheet, userId);

  const qEval = findQuestionInEvaluation(evaluation, questionIdOrNum);
  if (!qEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question ${questionIdOrNum} not found in evaluation.`);
  }

  if (qEval.reviewStatus === "pending") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Question ${qEval.questionNumber} must be reviewed (accepted or overridden) before finalization.`);
  }

  qEval.reviewStatus = "finalized";
  if (qEval.facultyEvaluation) {
    qEval.facultyEvaluation.status = "finalized";
    qEval.facultyEvaluation.finalizedAt = new Date();
    qEval.facultyEvaluation.finalizedBy = userId;
  }

  evaluation.auditHistory.push({
    action: "QUESTION_FINALIZED",
    questionNumber: `Q${qEval.questionNumber}`,
    newValue: { status: "finalized", finalMarks: qEval.finalAwardedMarks ?? qEval.facultyAwardedMarks },
    comment: `Question Q${qEval.questionNumber} locked and finalized by faculty.`,
    changedBy: userId,
  });

  await evaluation.save();
  return { evaluation, ansSheet, question: qEval };
};

/**
 * Finalizes entire student evaluation after all questions have been reviewed/finalized.
 */
export const finalizeStudentEvaluation = async (id, userId) => {
  const { evaluation, ansSheet } = await resolveEvaluationAndSheet(id);
  if (!evaluation || !ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found.");
  }

  await validateAccess(ansSheet, userId);

  if (ansSheet.reviewStatus === "FINALIZED" || evaluation.evaluationStatus === "finalized") {
    throw new ApiError(STATUS_CODES.CONFLICT, "Student evaluation has already been finalized.");
  }

  // Ensure all questions are reviewed or finalized
  const pendingQuestions = evaluation.questions.filter((q) => q.reviewStatus === "pending" && q.facultyEvaluation?.status === "pending");
  if (pendingQuestions.length > 0) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Cannot finalize student evaluation. ${pendingQuestions.length} question(s) are still pending review.`
    );
  }

  // Calculate totals: AI Total vs Faculty Final Total vs Total Difference
  let totalAiMarks = 0;
  let totalFacultyFinalMarks = 0;

  evaluation.questions.forEach((q) => {
    const aiM = q.aiEvaluation?.marksAwarded ?? q.aiMarks ?? 0;
    const facM = q.facultyAwardedMarks ?? q.facultyMarks ?? q.facultyEvaluation?.finalMarks ?? aiM;
    totalAiMarks += aiM;
    totalFacultyFinalMarks += facM;
    q.reviewStatus = "finalized";
    if (q.facultyEvaluation) {
      q.facultyEvaluation.status = "finalized";
      q.facultyEvaluation.finalizedAt = new Date();
      q.facultyEvaluation.finalizedBy = userId;
    }
  });

  const totalDifference = totalFacultyFinalMarks - totalAiMarks;
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);

  ansSheet.reviewStatus = "FINALIZED";
  ansSheet.finalizedAt = new Date();
  ansSheet.finalizedBy = userId;
  ansSheet.submissionStatus = "Completed";
  ansSheet.evaluationSummary = summary;
  
  ansSheet.resultPublication = {
    status: "READY_FOR_RESULT_PUBLICATION",
    publishedAt: null,
    publishedBy: null,
    unpublishedAt: null,
    unpublishedBy: null,
    publicationComment: null,
  };
  await ansSheet.save();

  evaluation.evaluationStatus = "finalized";
  evaluation.finalizedAt = new Date();
  evaluation.finalizedBy = userId;
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  evaluation.auditHistory.push({
    action: "EVALUATION_FINALIZED",
    comment: `Student evaluation finalized. Total AI Marks: ${totalAiMarks}, Final Faculty Marks: ${totalFacultyFinalMarks}, Difference: ${totalDifference >= 0 ? "+" : ""}${totalDifference}`,
    changedBy: userId,
  });

  await evaluation.save();

  return {
    evaluation,
    ansSheet,
    summary: {
      totalAiMarks,
      totalFacultyFinalMarks,
      totalDifference,
      percentage: summary.percentage,
      grade: evaluation.grade,
    },
  };
};

export default {
  validateAccess,
  getReviewQueue,
  getReviewDetails,
  startReview,
  reviewQuestion,
  addOverallComment,
  requestReEvaluation,
  requestRevision,
  approveReview,
  finalizeReview,
  acceptAiQuestion,
  overrideQuestion,
  finalizeSingleQuestion,
  finalizeStudentEvaluation,
  PREDEFINED_OVERRIDE_REASONS,
  resolveEvaluationAndSheet,
};

