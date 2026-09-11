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
    req.body.faculty = req.user._id ? req.user._id.toString() : req.user.id;
  }

  if (!req.body.course || req.body.course === "") {
    try {
      const Course = mongoose.model("Course");
      let defaultCourse = await Course.findOne({ isDeleted: false });
      if (!defaultCourse) {
        // Auto-create a default department and course if none exists
        const Department = mongoose.model("Department");
        let defaultDept = await Department.findOne({ isDeleted: false });
        if (!defaultDept) {
          defaultDept = await Department.create({
            name: "General Engineering & Technology",
            code: "GET" + Math.floor(Math.random() * 100),
            createdBy: req.user ? req.user._id : null,
          });
        }
        defaultCourse = await Course.create({
          name: "B.Tech General Degree Program",
          code: "BTGEN" + Math.floor(Math.random() * 100),
          durationYears: 4,
          totalSemesters: 8,
          department: defaultDept._id,
          createdBy: req.user ? req.user._id : null,
        });
      }
      req.body.course = defaultCourse._id.toString();
    } catch (err) {
      console.warn("Could not find or create a default course to auto-assign:", err);
    }
  }

  if (req.body.credits === undefined || req.body.credits === null || req.body.credits === "") {
    req.body.credits = 4;
  } else {
    req.body.credits = Number(req.body.credits);
  }

  if (req.body.semester !== undefined && req.body.semester !== null) {
    req.body.semester = Number(req.body.semester);
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
