import express from "express";
import calibrationController from "../controllers/calibration.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/summary")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getCalibrationSummary);

router
  .route("/by-question")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getQuestionLevelCalibration);

router
  .route("/by-confidence")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getConfidenceVsCorrection);

router
  .route("/reference-impact")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getReferenceEffectAnalysis);

router
  .route("/insights")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getCalibrationInsights);

router
  .route("/feedback")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.getLearningFeedbackDataset);

router
  .route("/feedback/:id/approval")
  .put(authorize(ROLES.FACULTY, ROLES.ADMIN), calibrationController.updateLearningApproval);

export default router;
