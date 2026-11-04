import express from "express";
import facultyController from "../controllers/faculty.controller.js";
import examController from "../controllers/exam.controller.js";
import resultPublicationController from "../controllers/resultPublication.controller.js";
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
router.get("/answer-sheets/review-queue", facultyController.getFacultyReviewQueue);
router.get("/answer-sheets/:id/review", facultyController.getFacultyReviewDetails);
router.post("/answer-sheets/:id/start-review", facultyController.startFacultyReview);
router.patch("/answer-sheets/:id/questions/:questionNumber/review", facultyController.overrideQuestion);
router.post("/answer-sheets/:id/questions/:questionNumber/accept-ai", facultyController.acceptAiQuestion);
router.post("/answer-sheets/:id/questions/:questionNumber/finalize", facultyController.finalizeSingleQuestion);
router.post("/answer-sheets/:id/finalize-student", facultyController.finalizeStudentEvaluation);
router.patch("/answer-sheets/:id/review/comment", facultyController.addOverallComment);
router.post("/answer-sheets/:id/request-re-evaluation", facultyController.requestReEvaluation);
router.post("/answer-sheets/:id/request-revision", facultyController.requestRevision);
router.post("/answer-sheets/:id/approve-review", facultyController.approveReview);
router.post("/answer-sheets/:id/finalize", facultyController.finalizeStudentEvaluation);

// Results Publication Endpoints
router.get("/results/publishable", resultPublicationController.getPublishableResults);
router.get("/results/published", resultPublicationController.getPublishedResults);
router.post("/answer-sheets/:id/publish-result", resultPublicationController.publishResult);
router.post("/answer-sheets/:id/unpublish-result", resultPublicationController.unpublishResult);
router.get("/answer-sheets/:id/publication-status", resultPublicationController.getPublicationStatus);

router.get("/students", facultyController.getFacultyStudents);
router.post(
  "/results/publish",
  publishResultsValidator,
  validate,
  facultyController.publishResults
);

router.put("/profile", facultyController.updateFacultyProfile);
router.put("/change-password", facultyController.changeFacultyPassword);

export default router;
