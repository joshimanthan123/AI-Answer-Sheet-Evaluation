import { Router } from "express";
import auth, { authorizeRoles } from "../middleware/auth.middleware.js";
import { ROLES } from "../constants/roles.js";
import * as analyticsController from "../controllers/analytics.controller.js";

const router = Router();

// Protect all analytics endpoints with authentication
router.use(auth);

/**
 * STUDENT ANALYTICS ENDPOINTS
 */
router.get(
  "/student/me",
  authorizeRoles(ROLES.STUDENT),
  analyticsController.getStudentMeAnalytics
);
router.get(
  "/student/me/trends",
  authorizeRoles(ROLES.STUDENT),
  analyticsController.getStudentMeTrends
);
router.get(
  "/student/me/exam/:examId",
  authorizeRoles(ROLES.STUDENT),
  analyticsController.getStudentMeExamDetails
);
router.get(
  "/student/me/insights",
  authorizeRoles(ROLES.STUDENT),
  analyticsController.getStudentInsights
);

/**
 * ADMIN ANALYTICS ENDPOINTS
 */
router.get(
  "/admin/overview",
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getAdminOverviewAnalytics
);
router.get(
  "/admin/exams",
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getAdminExamsAnalytics
);
router.get(
  "/admin/insights",
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getAdminInsights
);

/**
 * FACULTY & ADMIN EXAM ANALYTICS ENDPOINTS
 */
const authorizeFacultyOrAdmin = authorizeRoles(ROLES.FACULTY, ROLES.ADMIN);

router.get("/exams", authorizeFacultyOrAdmin, analyticsController.getAccessibleExams);
router.get("/exam/:examId", authorizeFacultyOrAdmin, analyticsController.getConsolidatedAnalytics);
router.get("/exam/:examId/insights", authorizeFacultyOrAdmin, analyticsController.getFacultyInsights);
router.get("/exam/:examId/overview", authorizeFacultyOrAdmin, analyticsController.getOverview);
router.get("/exam/:examId/students", authorizeFacultyOrAdmin, analyticsController.getStudents);
router.get("/exam/:examId/questions", authorizeFacultyOrAdmin, analyticsController.getQuestions);
router.get("/exam/:examId/distribution", authorizeFacultyOrAdmin, analyticsController.getExamDistribution);
router.get("/exam/:examId/ai-faculty", authorizeFacultyOrAdmin, analyticsController.getAIVsFaculty);
router.get("/exam/:examId/confidence", authorizeFacultyOrAdmin, analyticsController.getConfidence);
router.get("/exam/:examId/overrides", authorizeFacultyOrAdmin, analyticsController.getOverrides);

// Export generators
router.get("/exam/:examId/export/csv", authorizeFacultyOrAdmin, analyticsController.exportCSV);
router.get("/exam/:examId/export/pdf", authorizeFacultyOrAdmin, analyticsController.exportPDF);
router.get("/exam/:examId/export/excel", authorizeFacultyOrAdmin, analyticsController.exportExcel);

export default router;
