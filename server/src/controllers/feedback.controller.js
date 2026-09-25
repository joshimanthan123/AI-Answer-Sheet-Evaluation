import * as feedbackService from "../services/feedback.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * POST /api/feedback/override
 * Allows faculty/admin to submit structured feedback for an evaluation override.
 */
export const submitOverrideFeedback = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to submit faculty feedback.");
  }
  const feedback = await feedbackService.recordOverrideFeedback({
    ...req.body,
    userId: req.user._id,
  });
  return sendSuccess(res, STATUS_CODES.CREATED, "Evaluation feedback recorded successfully", feedback);
});

/**
 * GET /api/feedback
 * Retrieves paginated feedback history with search & filters.
 */
export const getAllFeedback = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to view internal faculty feedback.");
  }
  const result = await feedbackService.getFeedbackHistory(req.query, req.user);
  return sendSuccess(res, STATUS_CODES.OK, "Feedback history retrieved successfully", result.items, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

/**
 * GET /api/feedback/export/csv
 * Exports feedback in CSV format.
 */
export const exportFeedbackCSV = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to export feedback.");
  }
  const csvData = await feedbackService.exportFeedbackCSV(req.query, req.user);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=evaluation-feedback-report.csv");
  return res.send(csvData);
});

/**
 * GET /api/feedback/export/excel
 */
export const exportFeedbackExcel = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to export feedback.");
  }
  const csvData = await feedbackService.exportFeedbackCSV(req.query, req.user);
  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader("Content-Disposition", "attachment; filename=evaluation-feedback-report.xls");
  return res.send(csvData);
});

/**
 * GET /api/feedback/export/pdf
 */
export const exportFeedbackPDF = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Students are not authorized to export feedback.");
  }
  const result = await feedbackService.getFeedbackHistory({ ...req.query, limit: 1000 }, req.user);
  const items = result.items || [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Faculty Evaluation Feedback Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; font-weight: bold; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .diff-pos { color: #16a34a; font-weight: bold; }
        .diff-neg { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>AI Evaluation Faculty Feedback Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            <th>Exam</th>
            <th>Question</th>
            <th>AI Marks</th>
            <th>Final Marks</th>
            <th>Diff</th>
            <th>Reason</th>
            <th>Comment</th>
            <th>Faculty</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr>
              <td>${i.examId?.title || "Exam"}</td>
              <td>Q${i.questionNumber}</td>
              <td>${i.aiMarks}</td>
              <td>${i.finalMarks}</td>
              <td class="${i.difference >= 0 ? "diff-pos" : "diff-neg"}">${i.difference >= 0 ? "+" : ""}${i.difference}</td>
              <td>${i.reason}</td>
              <td>${i.comment || "-"}</td>
              <td>${i.createdBy?.name || "Faculty"}</td>
              <td>${new Date(i.createdAt).toLocaleDateString()}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", "inline; filename=evaluation-feedback-report.html");
  return res.send(html);
});

export default {
  submitOverrideFeedback,
  getAllFeedback,
  exportFeedbackCSV,
  exportFeedbackExcel,
  exportFeedbackPDF,
};
