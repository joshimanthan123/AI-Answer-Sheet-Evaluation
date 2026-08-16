import evaluationService from "../services/evaluation.service.js";
import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

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

export const startEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluationPipelineService.queueEvaluation(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation started successfully", {
    success: true,
    evaluationId: result._id,
    status: result.evaluationStatus,
  });
});

export const bulkEvaluate = asyncHandler(async (req, res) => {
  const result = await evaluationService.bulkEvaluate(
    req.params.examId,
    req.body.answerSheetIds,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Bulk evaluation processed", result);
});

export const reEvaluateAnswerSheet = asyncHandler(async (req, res) => {
  const result = await evaluationService.reEvaluateAnswerSheet(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Re-evaluation started successfully", {
    success: true,
    evaluationId: result._id,
    status: result.evaluationStatus,
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
  bulkEvaluate,
  reEvaluateAnswerSheet,
  reviewQuestion,
  finalizeEvaluation,
};
