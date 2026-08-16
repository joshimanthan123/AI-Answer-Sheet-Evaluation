import { body } from "express-validator";

export const examValidator = [
  body("subject")
    .notEmpty()
    .withMessage("Subject reference is required")
    .isMongoId()
    .withMessage("Subject must be a valid Mongo ID"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Exam title is required")
    .isLength({ max: 200 })
    .withMessage("Exam title cannot exceed 200 characters"),

  body("examType").trim().notEmpty().withMessage("Exam type is required"),

  body("totalMarks")
    .notEmpty()
    .withMessage("Total marks is required")
    .isInt({ min: 1 })
    .withMessage("Total marks must be a positive integer"),

  body("duration")
    .notEmpty()
    .withMessage("Duration (minutes) is required")
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive integer"),

  body("examDate")
    .notEmpty()
    .withMessage("Exam date is required")
    .isISO8601()
    .withMessage("Exam date must be a valid ISO 8601 date string"),

  body("startTime")
    .optional()
    .isISO8601()
    .withMessage("Start time must be a valid ISO 8601 date string"),

  body("endTime")
    .optional()
    .isISO8601()
    .withMessage("End time must be a valid ISO 8601 date string"),

  body("examStatus")
    .optional()
    .isIn(["Draft", "Published", "Active", "Completed"])
    .withMessage("Exam status must be Draft, Published, Active, or Completed"),

  body("isPublished").optional().isBoolean().withMessage("isPublished must be a boolean"),

  body("allowAutoSave").optional().isBoolean().withMessage("allowAutoSave must be a boolean"),

  body("allowLateSubmission")
    .optional()
    .isBoolean()
    .withMessage("allowLateSubmission must be a boolean"),

  body("submissionType")
    .optional()
    .isIn(["DigitalHandwriting"])
    .withMessage("submissionType must be DigitalHandwriting"),

  body("instructions").optional().trim(),

  body("questions")
    .optional()
    .isArray()
    .custom((value, { req }) => {
      if (req.body.examStatus !== "Draft" && (!value || value.length === 0)) {
        throw new Error("Questions must be a non-empty array when publishing");
      }
      return true;
    }),

  body("questions.*.questionNumber")
    .if((value, { req }) => req.body.examStatus !== "Draft" || value !== undefined)
    .notEmpty()
    .withMessage("Question number is required")
    .isInt({ min: 1 })
    .withMessage("Question number must be a positive integer"),

  body("questions.*.questionText")
    .if((value, { req }) => req.body.examStatus !== "Draft" || value !== undefined)
    .trim()
    .notEmpty()
    .withMessage("Question text is required"),

  body("questions.*.maximumMarks")
    .if((value, { req }) => req.body.examStatus !== "Draft" || value !== undefined)
    .notEmpty()
    .withMessage("Question maximum marks is required")
    .isInt({ min: 1 })
    .withMessage("Question maximum marks must be a positive integer"),

  body("questions.*.keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array of strings"),

  body("questions.*.keywords.*").trim().notEmpty().withMessage("Keyword string cannot be empty"),

  body("questions.*.modelAnswer").optional().trim(),

  body("questions.*.rubric").optional().trim(),

  body("questions.*.bloomsLevel")
    .optional()
    .isIn(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
    .withMessage("Invalid Bloom's level assigned"),

  body("questions.*.difficulty")
    .optional()
    .isIn(["Easy", "Medium", "Hard"])
    .withMessage("Difficulty must be Easy, Medium, or Hard"),

  body("questions.*.questionType")
    .optional()
    .isIn(["Descriptive", "Short Answer", "Long Answer", "MCQ", "True/False"])
    .withMessage("Difficulty must be Descriptive, Short Answer, Long Answer, MCQ, or True/False"),
];

export const answerKeyValidator = [
  body("modelAnswer").optional().trim(),
  body("keywords").optional().isArray().withMessage("Keywords must be an array of strings"),
  body("keywords.*").trim().notEmpty().withMessage("Keyword cannot be empty"),
  body("expectedAnswerLength")
    .optional()
    .isIn(["short", "medium", "long"])
    .withMessage("expectedAnswerLength must be short, medium, or long"),
  body("evaluationCriteria")
    .optional()
    .custom((val) => {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        const allowedKeys = [
          "conceptualUnderstanding",
          "keywordAccuracy",
          "completeness",
          "correctness",
        ];
        for (const k of Object.keys(val)) {
          if (!allowedKeys.includes(k)) {
            throw new Error(`Invalid criteria key: ${k}`);
          }
          if (typeof val[k] !== "number" || val[k] < 0) {
            throw new Error(`Criteria value for ${k} must be a non-negative number`);
          }
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (!item.name || typeof item.marks !== "number" || item.marks < 0) {
            throw new Error("Each array criterion must contain a name and non-negative marks");
          }
        }
      }
      return true;
    }),
  body("partialMarkingRules")
    .optional()
    .isArray()
    .withMessage("partialMarkingRules must be an array"),
  body("partialMarkingRules.*.criterion")
    .trim()
    .notEmpty()
    .withMessage("Partial marking criterion name is required"),
  body("partialMarkingRules.*.marks")
    .isFloat({ min: 0 })
    .withMessage("Partial marking marks must be a non-negative number"),
];

export default {
  examValidator,
  answerKeyValidator,
};
