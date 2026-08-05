import feedbackService from "../services/feedback.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createFeedback = asyncHandler(async (req, res) => {
  const result = await feedbackService.createFeedback(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Feedback submitted successfully", result);
});

export const getFeedbackById = asyncHandler(async (req, res) => {
  const result = await feedbackService.getFeedbackById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Feedback retrieved successfully", result);
});

export const getAllFeedback = asyncHandler(async (req, res) => {
  const result = await feedbackService.getAllFeedback(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Feedback list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateFeedback = asyncHandler(async (req, res) => {
  const result = await feedbackService.updateFeedback(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Feedback updated successfully", result);
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const result = await feedbackService.deleteFeedback(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Feedback deleted successfully", result);
});

export default {
  createFeedback,
  getFeedbackById,
  getAllFeedback,
  updateFeedback,
  deleteFeedback,
};
