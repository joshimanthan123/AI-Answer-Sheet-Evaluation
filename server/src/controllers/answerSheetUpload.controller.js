import answerSheetUploadService from "../services/answerSheetUpload.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

export const uploadAnswerSheet = asyncHandler(async (req, res) => {
  const { examId } = req.body;
  const file = req.file;

  if (!examId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "examId is required");
  }
  if (!file) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Multer file upload is required");
  }

  const result = await answerSheetUploadService.uploadAnswerSheet(examId, file, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Answer sheet uploaded successfully", result);
});

export const getUploadedAnswerSheets = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const result = await answerSheetUploadService.getUploadedAnswerSheets(examId, req.user._id);

  return sendSuccess(res, STATUS_CODES.OK, "Uploaded answer sheets retrieved", result);
});

export const deleteUploadedAnswerSheet = asyncHandler(async (req, res) => {
  const { answerSheetId } = req.params;
  const result = await answerSheetUploadService.deleteUploadedAnswerSheet(
    answerSheetId,
    req.user._id
  );

  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet deleted successfully", result);
});

export default {
  uploadAnswerSheet,
  getUploadedAnswerSheets,
  deleteUploadedAnswerSheet,
};
