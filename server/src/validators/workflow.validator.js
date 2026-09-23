import { body, param } from "express-validator";

export const startExamValidator = [
  param("examId").isMongoId().withMessage("Exam ID must be a valid Mongo ID"),
];

export const autoSaveValidator = [
  param("examId").isMongoId().withMessage("Exam ID must be a valid Mongo ID"),
  body("questionId").isMongoId().withMessage("questionId must be a valid Mongo ID"),
  body("handwrittenData").optional().trim(),
  body("recognizedText").optional().trim(),
  body("deviceInfo").optional().trim(),
];

export const submitExamValidator = [
  param("examId").isMongoId().withMessage("Exam ID must be a valid Mongo ID"),
  body("deviceInfo").optional().trim(),
];

export const publishResultsValidator = [
  body("examId").optional().isMongoId().withMessage("examId must be a valid Mongo ID"),
  body("answerSheetId")
    .optional()
    .isMongoId()
    .withMessage("answerSheetId must be a valid Mongo ID"),
];

export const questionValidator = [
  body("questionNumber")
    .notEmpty()
    .withMessage("Question number is required")
    .isInt({ min: 1 })
    .withMessage("Question number must be a positive integer"),
  body("questionText").trim().notEmpty().withMessage("Question text is required"),
  body("maximumMarks")
    .notEmpty()
    .withMessage("Maximum marks is required")
    .isInt({ min: 1 })
    .withMessage("Maximum marks must be a positive integer"),
  body("keywords").optional().isArray().withMessage("Keywords must be an array of strings"),
  body("keywords.*").trim().notEmpty().withMessage("Keyword string cannot be empty"),
  body("modelAnswer").optional().trim(),
  body("rubric").optional().trim(),
  body("rubricItems").optional().isArray().withMessage("rubricItems must be an array"),
  body("rubricItems.*.criterion")
    .if((val) => val !== undefined)
    .trim()
    .notEmpty()
    .withMessage("Rubric criterion name is required"),
  body("rubricItems.*.maxMarks")
    .if((val) => val !== undefined)
    .isFloat({ min: 0 })
    .withMessage("Rubric item maxMarks must be a non-negative number"),
  body().custom((reqBody) => {
    if (Array.isArray(reqBody.rubricItems) && reqBody.rubricItems.length > 0) {
      const qMax = reqBody.maximumMarks !== undefined ? reqBody.maximumMarks : reqBody.maxMarks;
      const rubricTotal = reqBody.rubricItems.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0);
      if (qMax !== undefined && rubricTotal !== Number(qMax)) {
        throw new Error(`Total rubric marks (${rubricTotal}) must equal question max marks (${qMax})`);
      }
    }
    return true;
  }),
  body("bloomsLevel")
    .optional()
    .isIn(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
    .withMessage("Invalid Bloom's level"),
  body("difficulty")
    .optional()
    .isIn(["Easy", "Medium", "Hard"])
    .withMessage("Difficulty must be Easy, Medium, or Hard"),
];

export const reorderQuestionsValidator = [
  body("questionsOrder")
    .isArray({ min: 1 })
    .withMessage("questionsOrder must be an array of question IDs"),
  body("questionsOrder.*")
    .isMongoId()
    .withMessage("Each question order element must be a valid Mongo ID"),
];

export default {
  startExamValidator,
  autoSaveValidator,
  submitExamValidator,
  publishResultsValidator,
  questionValidator,
  reorderQuestionsValidator,
};
