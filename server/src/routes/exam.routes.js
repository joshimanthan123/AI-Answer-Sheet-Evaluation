import express from "express";
import examController from "../controllers/exam.controller.js";
import answerSheetController from "../controllers/answerSheet.controller.js";
import { examValidator } from "../validators/exam.validator.js";
import {
  startExamValidator,
  autoSaveValidator,
  submitExamValidator,
  questionValidator,
  reorderQuestionsValidator,
} from "../validators/workflow.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

// Only Admins or Faculty can create or modify exams; Students can read exams
router
  .route("/")
  .post(authorize(ROLES.ADMIN, ROLES.FACULTY), examValidator, validate, examController.createExam)
  .get(examController.getAllExams);

// Student Examination lifecycle routes
router
  .route("/:examId/start")
  .post(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    startExamValidator,
    validate,
    answerSheetController.startExam
  );

router
  .route("/:examId/autosave")
  .post(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    autoSaveValidator,
    validate,
    answerSheetController.autoSaveAnswer
  );

router
  .route("/:examId/submit")
  .post(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    submitExamValidator,
    validate,
    answerSheetController.submitExam
  );

router
  .route("/:examId/status")
  .get(
    authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN),
    answerSheetController.getSubmissionStatus
  );

router
  .route("/:examId/instructions")
  .get(authorize(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN), examController.getInstructions);

router
  .route("/:examId/review")
  .get(authorize(ROLES.STUDENT, ROLES.ADMIN), answerSheetController.getReviewAnswers);

// Faculty Question Bank CRUD routes
router
  .route("/:examId/questions")
  .post(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    questionValidator,
    validate,
    examController.addQuestion
  );

router
  .route("/:examId/questions/reorder")
  .post(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    reorderQuestionsValidator,
    validate,
    examController.reorderQuestions
  );

router
  .route("/:examId/questions/:questionId")
  .put(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    questionValidator,
    validate,
    examController.updateQuestion
  )
  .delete(authorize(ROLES.FACULTY, ROLES.ADMIN), examController.deleteQuestion);

router
  .route("/:id")
  .get(examController.getExamById)
  .put(authorize(ROLES.ADMIN, ROLES.FACULTY), examValidator, validate, examController.updateExam)
  .delete(authorize(ROLES.ADMIN, ROLES.FACULTY), examController.deleteExam);

export default router;
