import express from "express";
import studentController from "../controllers/student.controller.js";
import resultPublicationController from "../controllers/resultPublication.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import upload from "../config/multer.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLES.STUDENT, ROLES.ADMIN));

router.get("/profile", studentController.getStudentProfile);
router.patch("/profile", upload.single("profilePhoto"), studentController.updateStudentProfile);

router.get("/dashboard", studentController.getStudentDashboard);
router.get("/results", resultPublicationController.getStudentResults);
router.get("/results/:answerSheetId", resultPublicationController.getStudentResultDetails);
router.post("/results/:evaluationId/reevaluate", studentController.requestStudentReevaluation);
router.get("/exams", studentController.getStudentExams);
router.get("/exams/:examId/eligibility", studentController.getStudentExamEligibility);
router.get("/exams/:examId/workspace", studentController.getStudentExamWorkspace);
router.post("/exams/:examId/start", studentController.startStudentExam);
router.patch("/exams/:examId/autosave", studentController.autosaveStudentExamAnswer);
router.post("/exams/:examId/submit", studentController.submitStudentExam);
router.get("/exams/:examId/submission-status", studentController.getStudentSubmissionStatus);
router.get("/exams/:examId/result", studentController.getStudentExamResult);
router.get("/exams/:examId", studentController.getStudentExamById);

export default router;
