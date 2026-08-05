import express from "express";
import subjectController from "../controllers/subject.controller.js";
import { subjectValidator } from "../validators/subject.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(authorize(ROLES.ADMIN), subjectValidator, validate, subjectController.createSubject)
  .get(subjectController.getAllSubjects);

router
  .route("/:id")
  .get(subjectController.getSubjectById)
  .put(authorize(ROLES.ADMIN), subjectValidator, validate, subjectController.updateSubject)
  .delete(authorize(ROLES.ADMIN), subjectController.deleteSubject);

export default router;
