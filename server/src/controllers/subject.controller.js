import subjectService from "../services/subject.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.createSubject(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Subject created successfully", result);
});

export const getSubjectById = asyncHandler(async (req, res) => {
  const result = await subjectService.getSubjectById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Subject retrieved successfully", result);
});

export const getAllSubjects = asyncHandler(async (req, res) => {
  const result = await subjectService.getAllSubjects(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Subjects list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.updateSubject(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Subject updated successfully", result);
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.deleteSubject(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Subject deleted successfully", result);
});

export default {
  createSubject,
  getSubjectById,
  getAllSubjects,
  updateSubject,
  deleteSubject,
};
