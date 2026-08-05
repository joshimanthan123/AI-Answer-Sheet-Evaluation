import { body } from "express-validator";

export const evaluationValidator = [
  body("answerSheet")
    .notEmpty()
    .withMessage("Answer sheet reference is required")
    .isMongoId()
    .withMessage("Answer sheet reference must be a valid Mongo ID"),

  body("evaluatedBy")
    .notEmpty()
    .withMessage("Evaluator reference is required")
    .isMongoId()
    .withMessage("Evaluated by reference must be a valid Mongo ID"),

  body("evaluationType")
    .trim()
    .notEmpty()
    .withMessage("Evaluation type is required")
    .isIn(["AI", "Faculty"])
    .withMessage("Evaluation type must be AI or Faculty"),

  body("obtainedMarks")
    .notEmpty()
    .withMessage("Obtained marks is required")
    .isFloat({ min: 0 })
    .withMessage("Obtained marks must be a non-negative number"),

  body("totalMarks")
    .notEmpty()
    .withMessage("Total marks is required")
    .isFloat({ min: 1 })
    .withMessage("Total marks must be a positive number"),

  body("evaluationStatus")
    .optional()
    .isIn(["AI_PENDING", "AI_COMPLETED", "FACULTY_REVIEW", "PUBLISHED"])
    .withMessage("Invalid evaluation status"),

  body("strengths").optional().trim(),

  body("weaknesses").optional().trim(),

  body("suggestions").optional().trim(),

  body("questions").optional().isArray().withMessage("Questions scoring must be an array"),

  body("questions.*.questionId")
    .notEmpty()
    .withMessage("Question reference is required")
    .isMongoId()
    .withMessage("questionId must be a valid Mongo ID"),

  body("questions.*.recognizedText").optional().trim(),

  body("questions.*.modelAnswer").optional().trim(),

  body("questions.*.similarityScore")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Similarity score must be decimal between 0 and 100"),

  body("questions.*.aiMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("AI marks must be non-negative"),

  body("questions.*.facultyMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Faculty marks must be non-negative"),

  body("questions.*.feedback").optional().trim(),
];

export default {
  evaluationValidator,
};
