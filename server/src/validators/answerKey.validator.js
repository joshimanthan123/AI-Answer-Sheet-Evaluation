import { body, param } from "express-validator";

export const getAnswerKeyValidator = [
  param("examId").isMongoId().withMessage("Invalid exam ID pattern"),
];

export const approveAnswerKeyValidator = [
  param("answerKeyId").isMongoId().withMessage("Invalid answer key ID pattern"),
];

export const updateAnswerKeyValidator = [
  param("answerKeyId").isMongoId().withMessage("Invalid answer key ID pattern"),
  body("parsedAnswers").isArray().withMessage("parsedAnswers must be an array of question data"),
  body("parsedAnswers.*.questionNumber")
    .isInt({ min: 1 })
    .withMessage("questionNumber must be a positive integer"),
  body("parsedAnswers.*.answerText")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("answerText cannot be empty"),
];

export const deleteAnswerKeyValidator = [
  param("answerKeyId").isMongoId().withMessage("Invalid answer key ID pattern"),
];

export default {
  getAnswerKeyValidator,
  approveAnswerKeyValidator,
  updateAnswerKeyValidator,
  deleteAnswerKeyValidator,
};
