import express from "express";
import facultyController from "../controllers/faculty.controller.js";
import examController from "../controllers/exam.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import { examValidator } from "../validators/exam.validator.js";
import { publishResultsValidator } from "../validators/workflow.validator.js";
import validate from "../middleware/validation.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLES.FACULTY, ROLES.ADMIN));

router.get("/dashboard", facultyController.getFacultyDashboard);
router.post("/exams", examValidator, validate, examController.createExam);
router.get("/submissions", facultyController.getFacultySubmissions);
router.get("/review-queue", facultyController.getFacultyReviewQueue);
router.post(
  "/results/publish",
  publishResultsValidator,
  validate,
  facultyController.publishResults
);

export default router;
