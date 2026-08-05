import { body } from "express-validator";

export const answerSheetValidator = [
  body("student")
    .notEmpty()
    .withMessage("Student reference is required")
    .isMongoId()
    .withMessage("Student reference must be a valid Mongo ID"),

  body("subject")
    .notEmpty()
    .withMessage("Subject reference is required")
    .isMongoId()
    .withMessage("Subject reference must be a valid Mongo ID"),

  body("exam")
    .notEmpty()
    .withMessage("Exam reference is required")
    .isMongoId()
    .withMessage("Exam reference must be a valid Mongo ID"),

  body("submissionStatus")
    .optional()
    .isIn(["Pending", "Processing", "Completed", "Failed"])
    .withMessage("Invalid submission status"),

  body("submittedAt")
    .optional()
    .isISO8601()
    .withMessage("submittedAt must be a valid ISO 8601 date string"),

  body("totalQuestions")
    .optional()
    .isInt({ min: 0 })
    .withMessage("totalQuestions must be a non-negative integer"),

  body("answers").optional().isArray().withMessage("answers must be an array of question answers"),

  body("answers.*.questionId")
    .notEmpty()
    .withMessage("questionId for each answer is required")
    .isMongoId()
    .withMessage("questionId must be a valid Mongo ID"),

  body("answers.*.handwrittenData").optional().trim(),

  body("answers.*.recognizedText").optional().trim(),

  body("answers.*.hwrStatus")
    .optional()
    .isIn(["Pending", "Processing", "Completed", "Failed"])
    .withMessage("Invalid hwrStatus for answer"),

  body("answers.*.submissionTime")
    .optional()
    .isISO8601()
    .withMessage("submissionTime must be a valid ISO 8601 date string"),
];

export default {
  answerSheetValidator,
};
