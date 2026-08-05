import express from "express";
import evaluationController from "../controllers/evaluation.controller.js";
import { evaluationValidator } from "../validators/evaluation.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    evaluationValidator,
    validate,
    evaluationController.createEvaluation
  )
  .get(evaluationController.getAllEvaluations);

router
  .route("/:id")
  .get(evaluationController.getEvaluationById)
  .put(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    evaluationValidator,
    validate,
    evaluationController.updateEvaluation
  )
  .delete(authorize(ROLES.ADMIN), evaluationController.deleteEvaluation);

export default router;
