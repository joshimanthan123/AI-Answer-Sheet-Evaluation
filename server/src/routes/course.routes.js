import express from "express";
import courseController from "../controllers/course.controller.js";
import { courseValidator } from "../validators/course.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(authorize(ROLES.ADMIN), courseValidator, validate, courseController.createCourse)
  .get(courseController.getAllCourses);

router
  .route("/:id")
  .get(courseController.getCourseById)
  .put(authorize(ROLES.ADMIN), courseValidator, validate, courseController.updateCourse)
  .delete(authorize(ROLES.ADMIN), courseController.deleteCourse);

export default router;
