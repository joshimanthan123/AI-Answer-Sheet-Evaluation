import * as improvementService from "../services/improvement.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/improvements/analytics
 */
export const getImprovementAnalytics = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to view AI improvement analytics.");
  }
  const data = await improvementService.getImprovementAnalytics(req.query.examId, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "AI Improvement analytics compiled successfully", data);
});

/**
 * POST /api/improvements/suggestions
 */
export const createSuggestion = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to create improvement suggestions.");
  }
  const suggestion = await improvementService.createImprovementSuggestion(req.body, req.user);
  return sendSuccess(res, STATUS_CODES.CREATED, "Improvement suggestion submitted successfully", suggestion);
});

/**
 * GET /api/improvements/suggestions
 */
export const getSuggestions = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to view improvement suggestions.");
  }
  const result = await improvementService.getImprovementSuggestions(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Improvement suggestions retrieved successfully", result.items, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

/**
 * GET /api/improvements/suggestions/:id
 */
export const getSuggestionDetails = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to view suggestion evidence.");
  }
  const data = await improvementService.getSuggestionEvidenceAndCompare(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Suggestion evidence and comparison payload retrieved successfully", data);
});

/**
 * POST /api/improvements/suggestions/:id/review
 * Action: approve | reject
 */
export const reviewSuggestion = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to approve or reject suggestions.");
  }
  const { action, reviewComment } = req.body;
  const result = await improvementService.reviewImprovementSuggestion(
    req.params.id,
    action,
    reviewComment,
    req.user
  );
  return sendSuccess(res, STATUS_CODES.OK, result.message, result);
});

export default {
  getImprovementAnalytics,
  createSuggestion,
  getSuggestions,
  getSuggestionDetails,
  reviewSuggestion,
};
