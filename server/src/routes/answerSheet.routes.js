import express from "express";
import answerSheetController from "../controllers/answerSheet.controller.js";
import { answerSheetValidator } from "../validators/answerSheet.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    answerSheetValidator,
    validate,
    answerSheetController.createAnswerSheet
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
  .route("/:id")
  .get(answerSheetController.getAnswerSheetById)
  .put(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    answerSheetValidator,
    validate,
    answerSheetController.updateAnswerSheet
  )
  .delete(authorize(ROLES.ADMIN), answerSheetController.deleteAnswerSheet);

export default router;
