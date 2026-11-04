import answerKeyService from "../services/answerKey.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

export const uploadAnswerKey = asyncHandler(async (req, res) => {
  const { examId } = req.body;
  const file = req.file;

  if (!examId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "examId is required");
  }
  if (!file) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Multer file upload is required");
  }

  const result = await answerKeyService.uploadAnswerKey(examId, file, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Answer key uploaded successfully", result);
});

export const getAnswerKey = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const result = await answerKeyService.getAnswerKey(examId);

  return sendSuccess(res, STATUS_CODES.OK, "Answer key retrieved successfully", result);
});

export const updateAnswerKey = asyncHandler(async (req, res) => {
  const { answerKeyId } = req.params;
  const result = await answerKeyService.updateAnswerKey(answerKeyId, req.body, req.user._id);

  return sendSuccess(res, STATUS_CODES.OK, "Answer key updated successfully", result);
});

export const approveAnswerKey = asyncHandler(async (req, res) => {
  const { answerKeyId } = req.params;
  const result = await answerKeyService.approveAnswerKey(answerKeyId, req.user._id);

  return sendSuccess(res, STATUS_CODES.OK, "Answer key approved successfully", result);
});

export const deleteAnswerKey = asyncHandler(async (req, res) => {
  const { answerKeyId } = req.params;
  const result = await answerKeyService.deleteAnswerKey(answerKeyId);

  return sendSuccess(res, STATUS_CODES.OK, "Answer key deleted successfully", result);
});

export default {
  uploadAnswerKey,
  getAnswerKey,
  updateAnswerKey,
  approveAnswerKey,
  deleteAnswerKey,
};
