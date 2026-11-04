import { body, param } from "express-validator";

export const uploadAnswerSheetValidator = [
  body("examId").isMongoId().withMessage("Invalid exam ID pattern"),
];

export const getUploadedAnswerSheetValidator = [
  param("examId").isMongoId().withMessage("Invalid exam ID pattern"),
];

export const deleteUploadedAnswerSheetValidator = [
  param("answerSheetId").isMongoId().withMessage("Invalid answer sheet ID pattern"),
];

export default {
  uploadAnswerSheetValidator,
  getUploadedAnswerSheetValidator,
  deleteUploadedAnswerSheetValidator,
};
