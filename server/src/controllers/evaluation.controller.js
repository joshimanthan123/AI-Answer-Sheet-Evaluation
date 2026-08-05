import evaluationService from "../services/evaluation.service.js";
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

export default {
  createEvaluation,
  getEvaluationById,
  getAllEvaluations,
  updateEvaluation,
  deleteEvaluation,
};
