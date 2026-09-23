import express from "express";
import * as evaluationV1Controller from "../controllers/evaluationV1.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/schema-info", evaluationV1Controller.getSchemaInfo);
router.post("/validate-rubric", evaluationV1Controller.validateRubric);
router.post("/evaluate", authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.evaluateAnswer);

router.patch("/:answerId/review", authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.reviewAnswer);
router.patch("/answers/:answerId/review", authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.reviewAnswer);
router.patch("/sheet/:sheetId/review", authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.reviewAnswer);

router.get("/answersheet/:answerSheetId/summary", authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.getEvaluationSummary);
router.get(
  "/answersheet/:answerSheetId/questions/:questionId/references",
  authorize(ROLES.FACULTY, ROLES.ADMIN),
  evaluationV1Controller.getQuestionReferenceEvidence
);

router.post(
  "/answersheet/:answerSheetId/questions/:questionId/reference-aware",
  authorize(ROLES.FACULTY, ROLES.ADMIN),
  evaluationV1Controller.triggerReferenceAwareEvaluation
);

router
  .route("/historical")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.getHistoricalEvaluations)
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.createHistoricalEvaluation);

export default router;

