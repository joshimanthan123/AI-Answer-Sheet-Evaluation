import { body } from "express-validator";

export const feedbackValidator = [
  body("student")
    .notEmpty()
    .withMessage("Student reference is required")
    .isMongoId()
    .withMessage("Student reference must be a valid Mongo ID"),

  body("evaluation")
    .notEmpty()
    .withMessage("Evaluation reference is required")
    .isMongoId()
    .withMessage("Evaluation reference must be a valid Mongo ID"),

  body("rating")
    .notEmpty()
    .withMessage("Rating number is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be an integer between 1 and 5"),

  body("comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Feedback comment cannot exceed 1000 characters"),
];

export default {
  feedbackValidator,
};
