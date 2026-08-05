import { body } from "express-validator";

export const subjectValidator = [
  body("course")
    .notEmpty()
    .withMessage("Course reference is required")
    .isMongoId()
    .withMessage("Course must be a valid Mongo ID"),

  body("semester")
    .notEmpty()
    .withMessage("Semester number is required")
    .isInt({ min: 1, max: 8 })
    .withMessage("Semester must be an integer between 1 and 8"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Subject name is required")
    .isLength({ max: 100 })
    .withMessage("Subject name cannot exceed 100 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Subject code is required")
    .isLength({ max: 20 })
    .withMessage("Subject code can be at max 20 characters"),

  body("credits")
    .notEmpty()
    .withMessage("Credits is required")
    .isInt({ min: 1, max: 10 })
    .withMessage("Credits must be an integer between 1 and 10"),

  body("faculty")
    .notEmpty()
    .withMessage("Assigning faculty is required")
    .isMongoId()
    .withMessage("Faculty must be a valid Mongo ID"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

export default {
  subjectValidator,
};
