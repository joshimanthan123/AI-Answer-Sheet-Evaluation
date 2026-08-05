import { body } from "express-validator";

export const courseValidator = [
  body("department")
    .notEmpty()
    .withMessage("Department reference is required")
    .isMongoId()
    .withMessage("Department must be a valid Mongo ID Object"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Course name is required")
    .isLength({ max: 100 })
    .withMessage("Course name cannot exceed 100 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Course code is required")
    .isLength({ max: 20 })
    .withMessage("Course code can be at max 20 characters"),

  body("durationYears")
    .notEmpty()
    .withMessage("Duration (years) is required")
    .isInt({ min: 1, max: 10 })
    .withMessage("Duration must be an integer between 1 and 10"),

  body("totalSemesters")
    .notEmpty()
    .withMessage("Total semesters quantity is required")
    .isInt({ min: 1, max: 20 })
    .withMessage("Total semesters must be an integer between 1 and 20"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

export default {
  courseValidator,
};
