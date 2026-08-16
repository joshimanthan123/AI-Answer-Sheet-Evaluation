import express from "express";
import mongoose from "mongoose";
import subjectController from "../controllers/subject.controller.js";
import { subjectValidator } from "../validators/subject.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

// Middleware to default properties before running class validation schemas
const prepareSubjectBody = async (req, res, next) => {
  if (req.user && req.user.role === ROLES.FACULTY) {
    req.body.faculty = req.user._id;
  }

  if (!req.body.course) {
    try {
      const Course = mongoose.model("Course");
      const defaultCourse = await Course.findOne({ isDeleted: false });
      if (defaultCourse) {
        req.body.course = defaultCourse._id.toString();
      }
    } catch (err) {
      console.warn("Could not find a default course to auto-assign:", err);
    }
  }

  if (req.body.credits === undefined) {
    req.body.credits = 4;
  }
  next();
};

router
  .route("/")
  .post(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    prepareSubjectBody,
    subjectValidator,
    validate,
    subjectController.createSubject
  )
  .get(subjectController.getAllSubjects);

router
  .route("/:id")
  .get(subjectController.getSubjectById)
  .put(
    authorize(ROLES.FACULTY, ROLES.ADMIN),
    prepareSubjectBody,
    subjectValidator,
    validate,
    subjectController.updateSubject
  )
  .delete(authorize(ROLES.FACULTY, ROLES.ADMIN), subjectController.deleteSubject);

export default router;
