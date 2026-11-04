import express from "express";
import answerSheetController from "../controllers/answerSheet.controller.js";
import evaluationController from "../controllers/evaluation.controller.js";
import { answerSheetValidator } from "../validators/answerSheet.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import upload from "../config/multer.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(
    (req, res, next) => {
      if (
        req.headers["content-type"] &&
        req.headers["content-type"].includes("multipart/form-data")
      ) {
        return upload.array("files")(req, res, next);
      }
      next();
    },
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    (req, res, next) => {
      if (req.files && req.files.length > 0) {
        return answerSheetController.uploadAnswerSheets(req, res, next);
      }
      return answerSheetController.createAnswerSheet(req, res, next);
    }
  )
  .get(answerSheetController.getAllAnswerSheets);

router
  .route("/exams/:id/start")
  .post(authorize(ROLES.STUDENT, ROLES.ADMIN), answerSheetController.startExam);

router
  .route("/exams/:id/autosave")
  .post(authorize(ROLES.STUDENT, ROLES.ADMIN), answerSheetController.autoSaveAnswer);

router
  .route("/exams/:id/submit")
  .post(authorize(ROLES.STUDENT, ROLES.ADMIN), answerSheetController.submitExam);

router
  .route("/exams/:id/status")
  .get(
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    answerSheetController.getSubmissionStatus
  );

router
  .route("/:id/retry")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), answerSheetController.retryAnswerSheet);

router
  .route("/:id/digital")
  .get(authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN), answerSheetController.getDigitalAnswers);

router
  .route("/:id")
  .get(authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN), answerSheetController.getAnswerSheetById)
  .put(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    answerSheetValidator,
    validate,
    answerSheetController.updateAnswerSheet
  )
  .delete(authorize(ROLES.FACULTY, ROLES.ADMIN), answerSheetController.deleteAnswerSheet);

router
  .route("/:id/evaluate")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationController.startEvaluation);

router
  .route("/:id/evaluation-status")
  .get(
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    evaluationController.getEvaluationStatus
  );

router
  .route("/:id/evaluation")
  .get(
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    evaluationController.getEvaluationResults
  );

router
  .route("/:id/answers/:question_number/evaluation")
  .get(
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    evaluationController.getQuestionEvaluation
  );

router
  .route("/:id/re-evaluate")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationController.reEvaluateAnswerSheet);

router
  .route("/:id/answers/:question_number/re-evaluate")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), evaluationController.reEvaluateQuestion);

export default router;
