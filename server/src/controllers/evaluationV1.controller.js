import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import HistoricalEvaluation from "../models/HistoricalEvaluation.js";
import ApiError from "../utils/ApiError.js";
import evaluationService from "../services/evaluation.service.js";

/**
 * GET /api/v1/evaluation/schema-info
 * Returns evaluation schema specs and system readiness for Phase 3A.
 */
export const getSchemaInfo = asyncHandler(async (req, res) => {
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation schema information retrieved successfully", {
    phase: "Phase 3A — Evaluation Database Foundation",
    readyForLLM: false,
    llmCallEnabled: false,
    supportedStatuses: {
      questionEvaluation: ["pending", "evaluating", "completed", "failed"],
      facultyReview: ["pending", "approved", "modified"],
      criteriaStatus: ["met", "partial", "missing", "pending"]
    },
    schemaFields: {
      question: ["questionNumber", "questionText", "maxMarks", "modelAnswer", "rubricItems"],
      aiEvaluation: [
        "marksAwarded",
        "maxMarks",
        "percentage",
        "criteria",
        "matchedConcepts",
        "missingConcepts",
        "feedback",
        "confidence",
        "evaluatedAt"
      ],
      facultyEvaluation: ["status", "finalMarks", "comment", "reviewedAt", "reviewedBy"],
      historicalEvaluationsCollection: "historical_evaluations"
    }
  });
});

/**
 * POST /api/v1/evaluation/validate-rubric
 * Helper endpoint to validate that rubric criteria total matches maximum marks.
 */
export const validateRubric = asyncHandler(async (req, res) => {
  const { maxMarks, maximumMarks, rubricItems } = req.body;
  const targetMax = maximumMarks !== undefined ? Number(maximumMarks) : Number(maxMarks);

  if (isNaN(targetMax) || targetMax <= 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "maxMarks must be a positive number greater than 0");
  }

  if (!Array.isArray(rubricItems)) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "rubricItems must be an array");
  }

  let totalRubricMarks = 0;
  const errors = [];

  rubricItems.forEach((item, index) => {
    if (!item.criterion || typeof item.criterion !== "string" || item.criterion.trim().length === 0) {
      errors.push(`Rubric item at index ${index} is missing criterion name`);
    }
    const itemMarks = Number(item.maxMarks);
    if (isNaN(itemMarks) || itemMarks < 0) {
      errors.push(`Rubric item at index ${index} (${item.criterion || 'Unnamed'}) has invalid maxMarks`);
    } else {
      totalRubricMarks += itemMarks;
    }
  });

  if (totalRubricMarks !== targetMax) {
    errors.push(`Total rubric marks (${totalRubricMarks}) must equal question maxMarks (${targetMax})`);
  }

  const isValid = errors.length === 0;

  return sendSuccess(res, STATUS_CODES.OK, isValid ? "Rubric configuration is valid" : "Rubric validation failed", {
    isValid,
    targetMaxMarks: targetMax,
    totalRubricMarks,
    errors
  });
});

/**
 * GET /api/v1/evaluation/historical
 * Retrieves records from historical_evaluations collection for Phase 3F preparation.
 */
export const getHistoricalEvaluations = asyncHandler(async (req, res) => {
  const { academicYear, subject, examName, questionNumber } = req.query;
  const query = {};

  if (academicYear) query.academicYear = academicYear;
  if (subject) query.subject = subject;
  if (examName) query.examName = examName;
  if (questionNumber) query.questionNumber = Number(questionNumber);

  const records = await HistoricalEvaluation.find(query).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(res, STATUS_CODES.OK, "Historical evaluations retrieved", records);
});

/**
 * POST /api/v1/evaluation/historical
 * Stores a reference evaluation into historical_evaluations collection for Phase 3F preparation.
 */
export const createHistoricalEvaluation = asyncHandler(async (req, res) => {
  const { academicYear, subject, examName, questionNumber, questionText, studentAnswer, marksAwarded, maxMarks, rubric } = req.body;

  if (!academicYear || !subject || !examName || !questionNumber || !questionText || maxMarks === undefined) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Missing required fields for historical evaluation");
  }

  const record = await HistoricalEvaluation.create({
    academicYear,
    subject,
    examName,
    questionNumber: Number(questionNumber),
    questionText,
    studentAnswer: studentAnswer || "",
    marksAwarded: Number(marksAwarded) || 0,
    maxMarks: Number(maxMarks),
    rubric: rubric || [],
    uploadedBy: req.user?._id
  });

  return sendSuccess(res, STATUS_CODES.CREATED, "Historical evaluation stored successfully", record);
});

/**
 * POST /api/v1/evaluation/evaluate
 * Triggers Phase 3C AI Semantic Answer Evaluation for a single question or an entire answer sheet.
 * Backend loads question, rubric, model answer, max marks, and student OCR answer from database.
 */
export const evaluateAnswer = asyncHandler(async (req, res) => {
  const { answerSheetId, questionId, questionNumber, scope, reEvaluate } = req.body;

  if (!answerSheetId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "answerSheetId is required");
  }

  const answerSheet = await AnswerSheet.findById(answerSheetId);
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Import pipeline service dynamically to avoid circular dependencies
  const { default: evaluationPipelineService } = await import("../services/ai/evaluationPipeline.service.js");

  const evalScope = scope || (questionId || questionNumber ? "QUESTION" : "FULL_SHEET");
  const qNum = questionNumber ? Number(questionNumber) : undefined;

  const evaluation = await evaluationPipelineService.triggerEvaluation({
    answerSheetId,
    scope: evalScope,
    questionNumber: qNum,
    reEvaluate: Boolean(reEvaluate),
    userId: req.user?._id,
  });

  const latestAttempt = evaluation.evaluationHistory?.[evaluation.evaluationHistory.length - 1]?.attempt || 1;
  await evaluationPipelineService.runPipeline(evaluation._id, answerSheetId, req.user?._id, latestAttempt, {
    scope: evalScope,
    questionNumber: qNum,
    reEvaluate: Boolean(reEvaluate),
  });

  const updatedEvaluation = await (await import("../models/Evaluation.js")).default.findById(evaluation._id);

  return sendSuccess(res, STATUS_CODES.OK, "AI Evaluation executed successfully", updatedEvaluation);
});

/**
 * PATCH /api/v1/evaluation/:answerId/review
 * PATCH /api/v1/evaluation/answers/:answerId/review
 * Review AI evaluation for an answer item / question / answer sheet.
 * Supports actions: "approve", "modify", "re_evaluate".
 */
export const reviewAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const targetId = answerId || req.params.id;

  const result = await evaluationService.reviewFacultyEvaluation(
    targetId,
    req.body,
    req.user._id
  );

  return sendSuccess(
    res,
    STATUS_CODES.OK,
    req.body.action === "approve"
      ? "AI evaluation approved successfully"
      : req.body.action === "modify"
      ? "Faculty final marks updated successfully"
      : "Re-evaluation requested successfully",
    result
  );
});

export const getEvaluationSummary = asyncHandler(async (req, res) => {
  const { answerSheetId } = req.params;
  const result = await evaluationService.calculateSheetEvaluationSummary(answerSheetId);
  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet evaluation summary calculated successfully", result);
});

export const finalizeAnswerSheet = asyncHandler(async (req, res) => {
  const { answerSheetId } = req.params;
  const result = await evaluationService.finalizeAnswerSheetEvaluation(
    answerSheetId,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet evaluation finalized successfully", result);
});

import referenceAwareEvaluationService from "../services/ai/referenceAwareEvaluation.service.js";

export const triggerReferenceAwareEvaluation = asyncHandler(async (req, res) => {
  const { answerSheetId, questionId } = req.params;
  const result = await referenceAwareEvaluationService.evaluateQuestionWithReferences({
    answerSheetId,
    questionId,
    userId: req.user._id,
  });

  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Reference-aware adaptive evaluation completed successfully",
    result
  );
});

export const getQuestionReferenceEvidence = asyncHandler(async (req, res) => {
  const { answerSheetId, questionId } = req.params;
  const result = await referenceAwareEvaluationService.getQuestionReferenceEvidence(
    answerSheetId,
    questionId
  );

  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Question reference evidence and borderline status retrieved successfully",
    result
  );
});

export default {
  getSchemaInfo,
  validateRubric,
  getHistoricalEvaluations,
  createHistoricalEvaluation,
  evaluateAnswer,
  reviewAnswer,
  getEvaluationSummary,
  finalizeAnswerSheet,
  triggerReferenceAwareEvaluation,
  getQuestionReferenceEvidence,
};

