import express from "express";
import studentController from "../controllers/student.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLES.STUDENT, ROLES.ADMIN));

router.get("/dashboard", studentController.getStudentDashboard);
router.get("/exams", studentController.getStudentExams);

export default router;
