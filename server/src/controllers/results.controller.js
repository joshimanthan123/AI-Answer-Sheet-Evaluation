import * as resultsService from "../services/results.service.js";
import Exam from "../models/Exam.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/exams/:examId/results
 */
export const getResultsForExam = asyncHandler(async (req, res) => {
  const data = await resultsService.getResultsForExam(
    req.params.examId,
    req.query,
    req.user._id,
    req.user.role
  );
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Exam results retrieved successfully",
    data.results,
    data.pagination
  );
});

/**
 * GET /api/exams/:examId/analytics
 */
export const getExamAnalytics = asyncHandler(async (req, res) => {
  const data = await resultsService.getExamAnalytics(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Exam analytics compiled successfully", data);
});

/**
 * GET /api/evaluations/:id/result
 */
export const getIndividualResult = asyncHandler(async (req, res) => {
  const data = await resultsService.getIndividualResult(req.params.id, req.user._id, req.user.role);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Individual result details retrieved successfully",
    data
  );
});

/**
 * GET /api/exams/:examId/results/export
 */
export const exportExamResultsCSV = asyncHandler(async (req, res) => {
  const csvData = await resultsService.exportExamResultsCSV(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=exam-results-${req.params.examId}.csv`
  );
  return res.send(csvData);
});

/**
 * GET /api/exams/:examId/results/report
 */
export const downloadExamSummaryReport = asyncHandler(async (req, res) => {
  const examId = req.params.examId;
  const userId = req.user._id;
  const role = req.user.role;

  // Enforce ownership
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } }).populate(
    "subject",
    "name code semester faculty"
  );
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam layout not found");
  }
  if (role === "faculty" && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam registry.");
  }

  // Get full finalized results (without pagination limit)
  const resultsData = await resultsService.getResultsForExam(
    examId,
    { limit: 10000, status: "finalized" },
    userId,
    role
  );

  const analytics = await resultsService.getExamAnalytics(examId, userId, role);

  const htmlContent = resultsService.generateExamSummaryHTML(exam, analytics, resultsData.results);

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", `inline; filename=exam-summary-${examId}.html`);
  return res.send(htmlContent);
});

/**
 * GET /api/evaluations/:id/report
 */
export const downloadIndividualResultReport = asyncHandler(async (req, res) => {
  const evaluationId = req.params.id;
  const userId = req.user._id;
  const role = req.user.role;

  const resultDetail = await resultsService.getIndividualResult(evaluationId, userId, role);

  // Requirement: Only finalized or published results can generate report
  if (!["FINALIZED", "finalized", "PUBLISHED", "published"].includes(resultDetail.status)) {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "Operation failed because the candidate evaluation is not finalized."
    );
  }

  const htmlContent = resultsService.generateIndividualReportHTML(resultDetail);

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", `inline; filename=individual-report-${evaluationId}.html`);
  return res.send(htmlContent);
});

export default {
  getResultsForExam,
  getExamAnalytics,
  getIndividualResult,
  exportExamResultsCSV,
  downloadExamSummaryReport,
  downloadIndividualResultReport,
};
