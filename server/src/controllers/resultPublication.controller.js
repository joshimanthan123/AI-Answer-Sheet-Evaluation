import * as resultPublicationService from "../services/resultPublication.service.js";
import * as studentResultService from "../services/studentResult.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

// --- FACULTY PUBLIC CONTROLLER ACTIONS ---

export const getPublishableResults = asyncHandler(async (req, res) => {
  const filters = {
    examId: req.query.examId,
    studentId: req.query.studentId,
    page: req.query.page,
    limit: req.query.limit,
  };
  const result = await resultPublicationService.getPublishableResults(filters, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Publishable results queue retrieved successfully", result.data, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getPublishedResults = asyncHandler(async (req, res) => {
  const filters = {
    examId: req.query.examId,
    studentId: req.query.studentId,
    page: req.query.page,
    limit: req.query.limit,
  };
  const result = await resultPublicationService.getPublishedResults(filters, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Published results queue retrieved successfully", result.data, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const publishResult = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  const result = await resultPublicationService.publishResult(id, req.user._id, comment);
  return sendSuccess(res, STATUS_CODES.OK, result.message, result.data);
});

export const unpublishResult = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const result = await resultPublicationService.unpublishResult(id, req.user._id, reason);
  return sendSuccess(res, STATUS_CODES.OK, result.message, result.data);
});

export const getPublicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await resultPublicationService.getPublicationStatus(id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Publication status retrieved successfully", result);
});

// --- STUDENT PUBLIC CONTROLLER ACTIONS ---

export const getStudentResults = asyncHandler(async (req, res) => {
  const filters = {
    examId: req.query.examId,
    page: req.query.page,
    limit: req.query.limit,
  };
  const result = await studentResultService.getStudentResults(req.user._id, filters);
  return sendSuccess(res, STATUS_CODES.OK, "Student results list retrieved successfully", result.data, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getStudentResultDetails = asyncHandler(async (req, res) => {
  const { answerSheetId } = req.params;
  const result = await studentResultService.getStudentResultDetails(answerSheetId, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Result details retrieved successfully", result);
});

export default {
  getPublishableResults,
  getPublishedResults,
  publishResult,
  unpublishResult,
  getPublicationStatus,
  getStudentResults,
  getStudentResultDetails,
};
