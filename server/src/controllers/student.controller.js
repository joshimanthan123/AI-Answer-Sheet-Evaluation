import dashboardService from "../services/dashboard.service.js";
import examService from "../services/exam.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const result = await dashboardService.getStudentDashboard(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Student dashboard retrieved successfully", result);
});

export const getStudentExams = asyncHandler(async (req, res) => {
  // Students can query published exams
  const result = await examService.getAllExams({ ...req.query, isPublished: true });
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Student exams retrieved successfully",
    result.data,
    result.pagination
  );
});

export default {
  getStudentDashboard,
  getStudentExams,
};
