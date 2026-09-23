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

import * as evaluationV1Controller from "../controllers/evaluationV1.controller.js";

import facultyController from "../controllers/faculty.controller.js";

router
  .route("/:evaluationId/questions/:questionId/accept-ai")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.acceptAiQuestion);

router
  .route("/:evaluationId/questions/:questionId/review")
  .patch(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.overrideQuestion)
  .put(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.overrideQuestion);

router
  .route("/:evaluationId/questions/:questionId/finalize")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.finalizeSingleQuestion);

router
  .route("/:id/questions/:questionId/review")
  .put(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.overrideQuestion);

router
  .route("/:answerId/review")
  .patch(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.reviewAnswer)
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.reviewAnswer);

router
  .route("/:evaluationId/finalize-student")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.finalizeStudentEvaluation);

router
  .route("/:id/finalize")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), facultyController.finalizeStudentEvaluation);

router
  .route("/answersheet/:answerSheetId/summary")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.getEvaluationSummary);

router
  .route("/answersheet/:answerSheetId/finalize")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationV1Controller.finalizeAnswerSheet);

router
  .route("/exam/:examId/review-dashboard")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationController.getReviewDashboard);

router
  .route("/:id/detail")
  .get(evaluationController.getEvaluationDetail);

router
  .route("/:id/review-status")
  .patch(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationController.updateReviewStatus);

import * as resultsController from "../controllers/results.controller.js";

router
  .route("/:id/result")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN, ROLES.STUDENT), resultsController.getIndividualResult);

router
  .route("/:id/report")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), resultsController.downloadIndividualResultReport);

export default router;

