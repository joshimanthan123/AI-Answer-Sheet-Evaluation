import dashboardService from "../services/dashboard.service.js";
import studentExamService from "../services/studentExam.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const result = await dashboardService.getStudentDashboard(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Student dashboard retrieved successfully", result);
});

export const getStudentExams = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentExams(req.user._id, req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exams retrieved successfully",
    result.exams,
    result.pagination
  );
});

export const getStudentExamById = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentExamById(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exam details retrieved successfully",
    result
  );
});

export const getStudentExamEligibility = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentExamEligibility(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exam eligibility retrieved successfully",
    result
  );
});

export const getStudentExamWorkspace = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentExamWorkspace(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exam workspace loaded successfully",
    result
  );
});

export const startStudentExam = asyncHandler(async (req, res) => {
  const result = await studentExamService.startStudentExam(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exam started successfully",
    result
  );
});

export const autosaveStudentExamAnswer = asyncHandler(async (req, res) => {
  const result = await studentExamService.autosaveStudentExamAnswer(req.user._id, req.params.examId, req.body);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Answer autosaved successfully",
    result
  );
});

export const submitStudentExam = asyncHandler(async (req, res) => {
  const result = await studentExamService.submitStudentExam(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Exam submitted successfully",
    result
  );
});

export const getStudentSubmissionStatus = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentSubmissionStatus(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student submission status retrieved successfully",
    result
  );
});

export const getStudentExamResult = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentExamResult(req.user._id, req.params.examId);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exam result retrieved successfully",
    result
  );
});

export const getStudentProfile = asyncHandler(async (req, res) => {
  const user = req.user.toJSON ? req.user.toJSON() : { ...req.user };
  delete user.password;
  return sendSuccess(res, STATUS_CODES.OK, "Profile retrieved successfully", { user });
});

export const updateStudentProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const { name } = req.body;

  if (name !== undefined) {
    user.name = name;
  }

  if (req.file) {
    user.profilePhoto = `/uploads/${req.file.filename}`;
  } else if (req.body.profilePhoto !== undefined) {
    user.profilePhoto = req.body.profilePhoto;
  }

  await user.save();

  const updatedUser = user.toJSON ? user.toJSON() : { ...user };
  delete updatedUser.password;

  return sendSuccess(res, STATUS_CODES.OK, "Profile updated successfully", { user: updatedUser });
});

export const getStudentResults = asyncHandler(async (req, res) => {
  const result = await studentExamService.getStudentResults(req.user._id);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student results retrieved successfully",
    result
  );
});

export default {
  getStudentDashboard,
  getStudentExams,
  getStudentExamById,
  getStudentExamEligibility,
  getStudentExamWorkspace,
  startStudentExam,
  autosaveStudentExamAnswer,
  submitStudentExam,
  getStudentSubmissionStatus,
  getStudentExamResult,
  getStudentResults,
  getStudentProfile,
  updateStudentProfile,
};
