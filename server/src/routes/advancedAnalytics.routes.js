import { Router } from "express";
import auth, { authorizeRoles } from "../middleware/auth.middleware.js";
import { ROLES } from "../constants/roles.js";
import * as advancedAnalyticsController from "../controllers/advancedAnalytics.controller.js";

const router = Router();

// Require authentication for all Phase 5C endpoints
router.use(auth);

// Faculty and Admin access for general analytics & monitoring endpoints
router.get("/filters", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getFilters);
router.get("/cross-exam", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getCrossExamAnalytics);
router.get("/performance-trends", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getPerformanceTrends);
router.get("/student-trends/:studentQuery", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getStudentPerformanceTrends);
router.get("/question-trends", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getQuestionTrends);
router.get("/repeated-correction-patterns", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getRepeatedCorrectionPatterns);
router.get("/ai-trends", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getAIEvaluationTrends);
router.get("/feedback-trends", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getFeedbackTrends);
router.get("/version-history/:examId", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getVersionHistoryTimeline);
router.get("/system-monitoring", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getSystemMonitoringMetrics);
router.get("/pipeline-health", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getPipelineHealth);
router.get("/review-priority/:examId", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.getReviewPriorityList);

// Admin-only endpoints
router.get("/admin-overview", authorizeRoles(ROLES.ADMIN), advancedAnalyticsController.getAdminOverview);
router.get("/audit-logs", authorizeRoles(ROLES.ADMIN), advancedAnalyticsController.getAuditLogs);
router.get("/alerts", authorizeRoles(ROLES.ADMIN, ROLES.FACULTY), advancedAnalyticsController.getSystemAlerts);
router.put("/alerts/config", authorizeRoles(ROLES.ADMIN), advancedAnalyticsController.updateAlertConfig);

// Exports
router.get("/export/csv", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.exportCSV);
router.get("/export/pdf", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.exportPDF);
router.get("/export/excel", authorizeRoles(ROLES.FACULTY, ROLES.ADMIN), advancedAnalyticsController.exportExcel);

export default router;
