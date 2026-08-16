import answerSheetService from "../services/answerSheet.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createAnswerSheet = asyncHandler(async (req, res) => {
  const result = await answerSheetService.createAnswerSheet(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Answer sheet submitted successfully", result);
});

export const getAnswerSheetById = asyncHandler(async (req, res) => {
  const result = await answerSheetService.getAnswerSheetById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet retrieved successfully", result);
});

export const getAllAnswerSheets = asyncHandler(async (req, res) => {
  const result = await answerSheetService.getAllAnswerSheets(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Answer sheets list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateAnswerSheet = asyncHandler(async (req, res) => {
  const result = await answerSheetService.updateAnswerSheet(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet updated successfully", result);
});

export const deleteAnswerSheet = asyncHandler(async (req, res) => {
  const result = await answerSheetService.deleteAnswerSheet(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Answer sheet deleted successfully", result);
});

export const startExam = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await answerSheetService.startExam(examId, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Exam started successfully", result);
});

export const autoSaveAnswer = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await answerSheetService.autoSaveAnswer(examId, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Answer auto-saved successfully", result);
});

export const submitExam = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await answerSheetService.submitExam(examId, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Exam submitted successfully", result);
});

export const getSubmissionStatus = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await answerSheetService.getSubmissionStatus(examId, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Exam status retrieved successfully", result);
});

export const getReviewAnswers = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await answerSheetService.getReviewStatus(examId, req.user._id);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Exam review answers status retrieved successfully",
    result
  );
});

export const getExamAnswerSheets = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const result = await answerSheetService.getExamAnswerSheets(examId, req.user._id, req.user.role);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Exam answer sheets list retrieved successfully",
    result
  );
});

export const uploadAnswerSheets = asyncHandler(async (req, res) => {
  const { examId, studentIdentifier } = req.body;

  if (!examId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam ID is required");
  }

  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "No files uploaded");
  }

  const result = await answerSheetService.uploadAnswerSheets(
    examId,
    files,
    studentIdentifier,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.CREATED, "Upload process initiated", result);
});

export const retryAnswerSheet = asyncHandler(async (req, res) => {
  const result = await answerSheetService.retryAnswerSheet(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Retry process initiated", result);
});

export default {
  createAnswerSheet,
  getAnswerSheetById,
  getAllAnswerSheets,
  updateAnswerSheet,
  deleteAnswerSheet,
  startExam,
  autoSaveAnswer,
  submitExam,
  getSubmissionStatus,
  getReviewAnswers,
  getExamAnswerSheets,
  uploadAnswerSheets,
  retryAnswerSheet,
};
