import express from "express";
import feedbackController from "../controllers/feedback.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), feedbackController.getAllFeedback);

router
  .route("/override")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), feedbackController.submitOverrideFeedback);

router
  .route("/export/csv")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), feedbackController.exportFeedbackCSV);

router
  .route("/export/excel")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), feedbackController.exportFeedbackExcel);

router
  .route("/export/pdf")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), feedbackController.exportFeedbackPDF);

export default router;
