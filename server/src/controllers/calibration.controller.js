import * as calibrationService from "../services/calibration.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/v1/calibration/summary
 */
export const getCalibrationSummary = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access calibration analytics.");
  }
  const summary = await calibrationService.getCalibrationSummary(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Calibration summary retrieved successfully", summary);
});

/**
 * GET /api/v1/calibration/by-question
 */
export const getQuestionLevelCalibration = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access calibration analytics.");
  }
  const data = await calibrationService.getQuestionLevelCalibration(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Question-level calibration retrieved successfully", data);
});

/**
 * GET /api/v1/calibration/by-confidence
 */
export const getConfidenceVsCorrection = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access calibration analytics.");
  }
  const data = await calibrationService.getConfidenceVsCorrection(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Confidence vs correction analysis retrieved successfully", data);
});

/**
 * GET /api/v1/calibration/reference-impact
 */
export const getReferenceEffectAnalysis = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access calibration analytics.");
  }
  const data = await calibrationService.getReferenceEffectAnalysis(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Reference impact analysis retrieved successfully", data);
});

/**
 * GET /api/v1/calibration/insights
 */
export const getCalibrationInsights = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access calibration insights.");
  }
  const insights = await calibrationService.getCalibrationInsights(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Calibration insights retrieved successfully", insights);
});

/**
 * GET /api/v1/calibration/feedback
 */
export const getLearningFeedbackDataset = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to access learning feedback dataset.");
  }
  const result = await calibrationService.getLearningFeedbackDataset(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Learning feedback dataset retrieved successfully", result.items, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

/**
 * PUT /api/v1/calibration/feedback/:id/approval
 */
export const updateLearningApproval = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to approve feedback for learning.");
  }
  const { approvedForLearning } = req.body;
  if (approvedForLearning === undefined) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Field 'approvedForLearning' (boolean) is required.");
  }

  const updated = await calibrationService.updateLearningApproval(req.params.id, approvedForLearning, req.user);
  return sendSuccess(res, STATUS_CODES.OK, `Learning approval updated to ${updated.approvedForLearning}`, updated);
});

/**
 * GET /api/v1/evaluation/:id/review-history
 */
export const getEvaluationReviewHistory = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to view evaluation review history.");
  }
  const history = await calibrationService.getEvaluationReviewHistory(req.params.id, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation review history retrieved successfully", history);
});

export default {
  getCalibrationSummary,
  getQuestionLevelCalibration,
  getConfidenceVsCorrection,
  getReferenceEffectAnalysis,
  getCalibrationInsights,
  getLearningFeedbackDataset,
  updateLearningApproval,
  getEvaluationReviewHistory,
};
