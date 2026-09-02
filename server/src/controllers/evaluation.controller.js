import evaluationService from "../services/evaluation.service.js";
import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";

export const createEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationService.createEvaluation(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Evaluation generated successfully", result);
});

export const getEvaluationById = asyncHandler(async (req, res) => {
  const result = await evaluationService.getEvaluationById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation retrieved successfully", result);
});

export const getAllEvaluations = asyncHandler(async (req, res) => {
  const result = await evaluationService.getAllEvaluations(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Evaluations list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationService.updateEvaluation(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation updated successfully", result);
});

export const deleteEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationService.deleteEvaluation(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation deleted successfully", result);
});

/**
 * POST /answer-sheets/:id/evaluate
 * Queues or starts the AI evaluation of an answer sheet.
 * Returns HTTP 202 Accepted.
 */
export const startEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationPipelineService.queueEvaluation(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.ACCEPTED, "AI evaluation started", {
    answerSheetId: req.params.id,
    evaluationStatus: "QUEUED_FOR_EVALUATION",
    progress: 0,
    message: "AI evaluation started",
  });
});

/**
 * GET /answer-sheets/:id/evaluation-status
 * Tracking evaluation progress details.
 */
export const getEvaluationStatus = asyncHandler(async (req, res) => {
  const sheet = await AnswerSheet.findOne({ _id: req.params.id, isDeleted: false });
  if (!sheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: sheet._id, isDeleted: false });
  let questionsCompleted = 0;
  let totalQuestions = 0;

  if (evaluation && evaluation.questions) {
    totalQuestions = evaluation.questions.length;
    questionsCompleted = evaluation.questions.filter(
      (q) => q.aiAwardedMarks !== undefined && !q.errorMessage
    ).length;
  }

  // Fallback to sheet length if evaluation not created
  if (totalQuestions === 0 && sheet.answers) {
    totalQuestions = sheet.answers.length;
  }

  return sendSuccess(res, STATUS_CODES.OK, "Evaluation status retrieved", {
    answerSheetId: sheet._id,
    evaluationStatus: sheet.evaluationStatus || "READY_FOR_EVALUATION",
    evaluationProgress: sheet.evaluationProgress || 0,
    currentStep: sheet.evaluationCurrentStep,
    questionsCompleted,
    totalQuestions,
    evaluationAttempt: sheet.evaluationAttempt || 0,
  });
});

/**
 * GET /answer-sheets/:id/evaluation
 * Gets the detailed evaluation record report and question-by-question metrics.
 */
export const getEvaluationResults = asyncHandler(async (req, res) => {
  const sheet = await AnswerSheet.findOne({ _id: req.params.id, isDeleted: false });
  if (!sheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: sheet._id, isDeleted: false })
    .populate("answerSheet")
    .lean();

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  return sendSuccess(res, STATUS_CODES.OK, "Evaluation results retrieved", evaluation);
});

/**
 * GET /answer-sheets/:id/answers/:question_number/evaluation
 * Retrieves evaluation results for single question.
 */
export const getQuestionEvaluation = asyncHandler(async (req, res) => {
  const sheet = await AnswerSheet.findOne({ _id: req.params.id, isDeleted: false });
  if (!sheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
  }

  const exam = await Exam.findById(sheet.exam);
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Handle formats like Q1 or 1
  const targetStr = req.params.question_number.replace(/\D/g, "");
  const examQuestion = exam.questions.find(
    (q) =>
      q.questionNumber.toString() === targetStr ||
      q.questionNumber.toString() === req.params.question_number
  );
  if (!examQuestion) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in Exam");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: sheet._id, isDeleted: false }).lean();
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  const questionEval = evaluation.questions.find(
    (qe) => qe.questionId.toString() === examQuestion._id.toString()
  );
  if (!questionEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question evaluation result not found");
  }

  return sendSuccess(res, STATUS_CODES.OK, "Question evaluation retrieved", questionEval);
});

export const bulkEvaluate = asyncHandler(async (req, res) => {
  const result = await evaluationService.bulkEvaluate(
    req.params.examId,
    req.body.answerSheetIds,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Bulk evaluation processed", result);
});

/**
 * POST /answer-sheets/:id/re-evaluate
 * Trigger re-evaluation of full sheet
 */
export const reEvaluateAnswerSheet = asyncHandler(async (req, res) => {
  const result = await evaluationService.reEvaluateAnswerSheet(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.ACCEPTED, "Re-evaluation started", {
    answerSheetId: req.params.id,
    evaluationStatus: result.evaluationStatus,
    evaluationAttempt: result.evaluationHistory[result.evaluationHistory.length - 1]?.attempt || 1,
  });
});

/**
 * POST /answer-sheets/:id/answers/:question_number/re-evaluate
 * Trigger evaluation of a single question
 */
export const reEvaluateQuestion = asyncHandler(async (req, res) => {
  const sheet = await AnswerSheet.findOne({ _id: req.params.id, isDeleted: false });
  if (!sheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
  }

  const exam = await Exam.findById(sheet.exam);
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const targetStr = req.params.question_number.replace(/\D/g, "");
  const examQuestion = exam.questions.find(
    (q) =>
      q.questionNumber.toString() === targetStr ||
      q.questionNumber.toString() === req.params.question_number
  );
  if (!examQuestion) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "QUESTION_NOT_FOUND");
  }

  const result = await evaluationService.reEvaluateQuestion(
    req.params.id,
    examQuestion.questionNumber,
    req.user._id
  );

  return sendSuccess(res, STATUS_CODES.ACCEPTED, "Question re-evaluation started", {
    answerSheetId: req.params.id,
    questionNumber: examQuestion.questionNumber,
    evaluationStatus: result.evaluationStatus,
  });
});

export const reviewQuestion = asyncHandler(async (req, res) => {
  const result = await evaluationService.reviewQuestion(
    req.params.id,
    req.params.questionId,
    req.body,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Question evaluation review saved", result);
});

export const finalizeEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationService.finalizeEvaluation(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation finalized successfully", result);
});

export default {
  createEvaluation,
  getEvaluationById,
  getAllEvaluations,
  updateEvaluation,
  deleteEvaluation,
  startEvaluation,
  getEvaluationStatus,
  getEvaluationResults,
  getQuestionEvaluation,
  bulkEvaluate,
  reEvaluateAnswerSheet,
  reEvaluateQuestion,
  reviewQuestion,
  finalizeEvaluation,
};
