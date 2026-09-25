import * as advancedAnalyticsService from "../services/advancedAnalytics.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import { logAuditEvent } from "../utils/auditLogger.js";

/**
 * GET /api/advanced-analytics/filters
 */
export const getFilters = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getAvailableFilters(req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Available analytics filters retrieved successfully", data);
});

/**
 * GET /api/advanced-analytics/cross-exam
 */
export const getCrossExamAnalytics = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getCrossExamAnalytics(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Cross-exam analytics compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/performance-trends
 */
export const getPerformanceTrends = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getPerformanceTrends(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Performance trends compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/student-trends/:studentQuery
 */
export const getStudentPerformanceTrends = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getStudentPerformanceTrends(
    req.params.studentQuery,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Student historical performance trend compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/question-trends
 */
export const getQuestionTrends = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getQuestionTrends(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Question trends compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/repeated-correction-patterns
 */
export const getRepeatedCorrectionPatterns = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getRepeatedCorrectionPatterns(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Repeated correction patterns compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/ai-trends
 */
export const getAIEvaluationTrends = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getAIEvaluationTrends(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "AI evaluation trends compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/feedback-trends
 */
export const getFeedbackTrends = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getFeedbackTrends(req.query, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Feedback type trends compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/version-history/:examId
 */
export const getVersionHistoryTimeline = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getVersionHistoryTimeline(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Reference/Rubric version history timeline compiled successfully", data);
});

/**
 * GET /api/advanced-analytics/system-monitoring
 */
export const getSystemMonitoringMetrics = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getSystemMonitoringMetrics();
  return sendSuccess(res, STATUS_CODES.OK, "System monitoring metrics retrieved successfully", data);
});

/**
 * GET /api/advanced-analytics/pipeline-health
 */
export const getPipelineHealth = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getPipelineHealth(req.query);
  return sendSuccess(res, STATUS_CODES.OK, "Pipeline health metrics retrieved successfully", data);
});

/**
 * GET /api/advanced-analytics/admin-overview
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getAdminOverview();
  return sendSuccess(res, STATUS_CODES.OK, "Admin system overview retrieved successfully", data);
});

/**
 * GET /api/advanced-analytics/audit-logs
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const data = await advancedAnalyticsService.getAuditLogSearch(req.query, page, limit);

  // Log audit search action itself
  await logAuditEvent({
    user: req.user._id,
    userName: req.user.name,
    userRole: req.user.role,
    action: "SEARCH_AUDIT_LOGS",
    entityType: "AuditLog",
    details: `Searched system audit logs with query: ${JSON.stringify(req.query)}`,
  });

  return sendSuccess(res, STATUS_CODES.OK, "Audit logs retrieved successfully", data);
});

/**
 * GET /api/advanced-analytics/review-priority/:examId
 */
export const getReviewPriorityList = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getReviewPriorityList(
    req.params.examId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Review priority indicators calculated successfully", data);
});

/**
 * GET /api/advanced-analytics/alerts
 */
export const getSystemAlerts = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.getSystemAlerts();
  return sendSuccess(res, STATUS_CODES.OK, "System alerts retrieved successfully", data);
});

/**
 * PUT /api/advanced-analytics/alerts/config
 */
export const updateAlertConfig = asyncHandler(async (req, res) => {
  const data = await advancedAnalyticsService.updateAlertConfig(req.body, req.user._id);
  await logAuditEvent({
    user: req.user._id,
    userName: req.user.name,
    userRole: req.user.role,
    action: "UPDATE_ALERT_CONFIG",
    entityType: "SystemAlertConfig",
    details: `Updated alert threshold config: ${JSON.stringify(req.body)}`,
  });

  return sendSuccess(res, STATUS_CODES.OK, "Alert configuration updated successfully", data);
});

/**
 * EXPORT CSV
 */
export const exportCSV = asyncHandler(async (req, res) => {
  const csvData = await advancedAnalyticsService.generateAdvancedAnalyticsCSV(
    req.query,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=advanced-system-analytics.csv");
  return res.send(csvData);
});

/**
 * EXPORT PDF/HTML
 */
export const exportPDF = asyncHandler(async (req, res) => {
  const htmlData = await advancedAnalyticsService.generateAdvancedAnalyticsHTML(
    req.query,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", "inline; filename=advanced-system-analytics.html");
  return res.send(htmlData);
});

/**
 * EXPORT Excel
 */
export const exportExcel = asyncHandler(async (req, res) => {
  const excelData = await advancedAnalyticsService.generateAdvancedAnalyticsExcel(
    req.query,
    req.user._id,
    req.user.role
  );
  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader("Content-Disposition", "attachment; filename=advanced-system-analytics.xls");
  return res.send(excelData);
});

export default {
  getFilters,
  getCrossExamAnalytics,
  getPerformanceTrends,
  getStudentPerformanceTrends,
  getQuestionTrends,
  getRepeatedCorrectionPatterns,
  getAIEvaluationTrends,
  getFeedbackTrends,
  getVersionHistoryTimeline,
  getSystemMonitoringMetrics,
  getPipelineHealth,
  getAdminOverview,
  getAuditLogs,
  getReviewPriorityList,
  getSystemAlerts,
  updateAlertConfig,
  exportCSV,
  exportPDF,
  exportExcel,
};
