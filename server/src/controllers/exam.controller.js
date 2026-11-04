import examService from "../services/exam.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createExam = asyncHandler(async (req, res) => {
  const result = await examService.createExam(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Exam created successfully", result);
});

export const getExamById = asyncHandler(async (req, res) => {
  const result = await examService.getExamById(req.params.id, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Exam retrieved successfully", result);
});

export const getAllExams = asyncHandler(async (req, res) => {
  const result = await examService.getAllExams(req.query, req.user._id, req.user.role);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Exams list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateExam = asyncHandler(async (req, res) => {
  const result = await examService.updateExam(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Exam updated successfully", result);
});

export const deleteExam = asyncHandler(async (req, res) => {
  const result = await examService.deleteExam(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Exam deleted successfully", result);
});

export const getInstructions = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await examService.getInstructions(examId);
  return sendSuccess(res, STATUS_CODES.OK, "Exam instructions retrieved successfully", result);
});

export const addQuestion = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await examService.addQuestion(examId, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Question added successfully", result);
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const { questionId } = req.params;
  const result = await examService.updateQuestion(examId, questionId, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Question updated successfully", result);
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const { questionId } = req.params;
  const result = await examService.deleteQuestion(examId, questionId, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Question deleted successfully", result);
});

export const reorderQuestions = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await examService.reorderQuestions(examId, req.body.questionsOrder, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Questions reordered successfully", result);
});

export const updateQuestionAnswerKey = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const { questionId } = req.params;
  const result = await examService.updateQuestionAnswerKey(
    examId,
    questionId,
    req.body,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Answer key question updated successfully", result);
});

export const finalizeAnswerKey = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await examService.finalizeAnswerKey(examId, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Answer key finalized and locked successfully", result);
});

export const unlockAnswerKey = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await examService.unlockAnswerKey(examId, req.user._id, req.user.role);
  return sendSuccess(res, STATUS_CODES.OK, "Answer key unlocked successfully", result);
});

export const getEvaluationConfig = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const { questionId } = req.params;
  const result = await examService.getEvaluationConfig(
    examId,
    questionId,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation configuration retrieved successfully", result);
});

export const saveEvaluationConfig = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const { questionId } = req.params;
  const result = await examService.saveEvaluationConfig(
    examId,
    questionId,
    req.body,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Evaluation configuration saved successfully", result);
});

export default {
  createExam,
  getExamById,
  getAllExams,
  updateExam,
  deleteExam,
  getInstructions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  updateQuestionAnswerKey,
  finalizeAnswerKey,
  unlockAnswerKey,
  getEvaluationConfig,
  saveEvaluationConfig,
};
