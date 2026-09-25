import * as analyticsService from "../services/analytics.service.js";
import * as insightService from "../services/insight.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * GET /api/analytics/exams
 */
export const getAccessibleExams = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAccessibleExams(req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Accessible exams list retrieved successfully", data);
});

/**
 * GET /api/analytics/exam/:examId
 */
export const getConsolidatedAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getConsolidatedAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Consolidated analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/overview
 */
export const getOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getExamOverviewAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Exam overview analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/students
 */
export const getStudents = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentPerformanceAnalytics(
    req.params.examId,
    req.query,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Student performance analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/questions
 */
export const getQuestions = asyncHandler(async (req, res) => {
  const data = await analyticsService.getQuestionPerformanceAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Question performance analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/ai-faculty
 */
export const getAIVsFaculty = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAIVsFacultyAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "AI vs Faculty evaluation analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/confidence
 */
export const getConfidence = asyncHandler(async (req, res) => {
  const data = await analyticsService.getConfidenceAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "AI confidence analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/overrides
 */
export const getOverrides = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOverrideAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Override analytics compiled successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/distribution
 */
export const getExamDistribution = asyncHandler(async (req, res) => {
  const data = await analyticsService.getExamDistributionAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Exam mark distribution analytics compiled successfully", data);
});

/**
 * GET /api/analytics/student/me
 */
export const getStudentMeAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentMeAnalytics(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Student personal performance metrics retrieved successfully", data);
});

/**
 * GET /api/analytics/student/me/trends
 */
export const getStudentMeTrends = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentMeTrends(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Student performance trend retrieved successfully", data);
});

/**
 * GET /api/analytics/student/me/exam/:examId
 */
export const getStudentMeExamDetails = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentMeExamDetails(req.user._id, req.params.examId);
  return sendSuccess(res, STATUS_CODES.OK, "Student exam breakdown retrieved successfully", data);
});

/**
 * GET /api/analytics/admin/overview
 */
export const getAdminOverviewAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAdminOverviewAnalytics();
  return sendSuccess(res, STATUS_CODES.OK, "Admin aggregate overview metrics retrieved successfully", data);
});

/**
 * GET /api/analytics/admin/exams
 */
export const getAdminExamsAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAdminExamsAnalytics();
  return sendSuccess(res, STATUS_CODES.OK, "Admin exam comparison analytics retrieved successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/export/csv
 */
export const exportCSV = asyncHandler(async (req, res) => {
  const csvData = await analyticsService.generateAnalyticsCSV(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=evaluation-analytics-${req.params.examId}.csv`
  );
  return res.send(csvData);
});

/**
 * GET /api/analytics/exam/:examId/export/pdf
 */
export const exportPDF = asyncHandler(async (req, res) => {
  const htmlData = await analyticsService.generateAnalyticsHTML(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "text/html");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=evaluation-analytics-${req.params.examId}.html`
  );
  return res.send(htmlData);
});

/**
 * GET /api/analytics/exam/:examId/export/excel
 */
export const exportExcel = asyncHandler(async (req, res) => {
  const excelData = await analyticsService.generateAnalyticsExcel(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=evaluation-analytics-${req.params.examId}.xls`
  );
  return res.send(excelData);
});

/**
 * GET /api/analytics/student/me/insights
 */
export const getStudentInsights = asyncHandler(async (req, res) => {
  const data = await insightService.getStudentInsights(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Student personal performance insights retrieved successfully", data);
});

/**
 * GET /api/analytics/exam/:examId/insights
 */
export const getFacultyInsights = asyncHandler(async (req, res) => {
  const data = await insightService.getFacultyInsights(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Exam performance insights retrieved successfully", data);
});

/**
 * GET /api/analytics/admin/insights
 */
export const getAdminInsights = asyncHandler(async (req, res) => {
  const data = await insightService.getAdminInsights();
  return sendSuccess(res, STATUS_CODES.OK, "Admin aggregate insights retrieved successfully", data);
});

export default {
  getAccessibleExams,
  getConsolidatedAnalytics,
  getOverview,
  getStudents,
  getQuestions,
  getExamDistribution,
  getAIVsFaculty,
  getConfidence,
  getOverrides,
  getStudentMeAnalytics,
  getStudentMeTrends,
  getStudentMeExamDetails,
  getStudentInsights,
  getFacultyInsights,
  getAdminInsights,
  getAdminOverviewAnalytics,
  getAdminExamsAnalytics,
  exportCSV,
  exportPDF,
  exportExcel,
};
