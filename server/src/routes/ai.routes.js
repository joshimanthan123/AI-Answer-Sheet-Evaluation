import express from "express";
import { param } from "express-validator";
import aiController from "../controllers/ai.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import validate from "../middleware/validation.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/evaluate/:answerSheetId",
  authorize(ROLES.FACULTY, ROLES.ADMIN),
  [param("answerSheetId").isMongoId().withMessage("Invalid answer sheet reference ID")],
  validate,
  aiController.evaluateAnswerSheet
);

router.get(
  "/status/:evaluationId",
  authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
  [param("evaluationId").isMongoId().withMessage("Invalid evaluation reference ID")],
  validate,
  aiController.getEvaluationStatus
);

router.get(
  "/report/:evaluationId",
  authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
  [param("evaluationId").isMongoId().withMessage("Invalid evaluation reference ID")],
  validate,
  aiController.getEvaluationReport
);

router.post(
  "/retry/:evaluationId",
  authorize(ROLES.FACULTY, ROLES.ADMIN),
  [param("evaluationId").isMongoId().withMessage("Invalid evaluation reference ID")],
  validate,
  aiController.retryEvaluation
);

export default router;
