import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";

export const calculateTotalMarks = (questions) => {
  if (!questions || !Array.isArray(questions)) return 0;
  return questions.reduce((sum, q) => sum + (Number(q.maximumMarks) || 0), 0);
};

export const validateQuestionNumbers = (questions) => {
  if (!questions || !Array.isArray(questions)) return;
  const numbers = questions.map((q) => Number(q.questionNumber)).filter((n) => !isNaN(n));
  const uniqueNumbers = new Set(numbers);
  if (uniqueNumbers.size !== numbers.length) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Duplicate question numbers are not allowed");
  }
};

export const validateMarksDistribution = (questions, totalMarks, isDraft) => {
  if (isDraft) return;
  const sum = calculateTotalMarks(questions);
  if (sum !== Number(totalMarks)) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Total marks of questions (${sum}) does not match the exam totalMarks (${totalMarks})`
    );
  }
};

export const checkDuplicateTexts = (questions) => {
  if (!questions || !Array.isArray(questions)) return;
  const texts = questions
    .map((q) => q.questionText?.trim().toLowerCase())
    .filter((t) => t && t.length > 0);
  const uniqueTexts = new Set(texts);
  if (uniqueTexts.size !== texts.length) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Duplicate question text detected. Please ensure all questions are distinct."
    );
  }
};

export const createExamWithQuestions = async (data, userId) => {
  const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
  }

  const { questions = [], ...examData } = data;
  const isDraft = data.examStatus === "Draft";

  validateQuestionNumbers(questions);
  checkDuplicateTexts(questions);
  if (!isDraft) {
    validateMarksDistribution(questions, data.totalMarks, isDraft);
  }

  const parsedQuestions = questions.map((q, idx) => ({
    ...q,
    questionNumber: q.questionNumber || idx + 1,
  }));

  const exam = await Exam.create({
    ...examData,
    questions: parsedQuestions,
    createdBy: userId,
    updatedBy: userId,
  });

  logger.info(`Exam created with questions: ${exam._id} by user ${userId}`);
  return exam;
};

export const updateExamQuestions = async (examId, questionsData, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const isDraft = exam.examStatus === "Draft";
  validateQuestionNumbers(questionsData);
  checkDuplicateTexts(questionsData);
  if (!isDraft) {
    validateMarksDistribution(questionsData, exam.totalMarks, isDraft);
  }

  const parsedQuestions = questionsData.map((q, idx) => ({
    ...q,
    questionNumber: q.questionNumber || idx + 1,
  }));

  exam.questions = parsedQuestions;
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Exam questions updated: ${examId} by user ${userId}`);
  return exam;
};

export const createExam = async (data, userId) => {
  return createExamWithQuestions(data, userId);
};

export const getExamById = async (id) => {
  const exam = await Exam.findOne({ _id: id, isDeleted: false })
    .populate("subject", "name code semester")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }
  return exam;
};

export const getAllExams = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sort = "-createdAt",
    subject,
    examType,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (search) {
    mongoQuery.title = { $regex: search, $options: "i" };
  }

  if (subject) {
    mongoQuery.subject = subject;
  }

  if (examType) {
    mongoQuery.examType = examType;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Exam.countDocuments(mongoQuery);
  const data = await Exam.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("subject", "name code semester")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  return {
    data,
    pagination: {
      total,
      page: Number(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const updateExam = async (id, data, userId) => {
  const exam = await Exam.findOne({ _id: id, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  if (data.subject) {
    const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
    if (!subject) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
    }
  }

  const isDraft = (data.examStatus || exam.examStatus) === "Draft";
  const questionsToCheck = data.questions !== undefined ? data.questions : exam.questions;

  if (data.questions !== undefined) {
    validateQuestionNumbers(questionsToCheck);
    checkDuplicateTexts(questionsToCheck);
    if (!isDraft) {
      validateMarksDistribution(questionsToCheck, data.totalMarks || exam.totalMarks, isDraft);
    }
    data.questions = questionsToCheck.map((q, idx) => ({
      ...q,
      questionNumber: q.questionNumber || idx + 1,
    }));
  } else if (data.totalMarks !== undefined && !isDraft) {
    validateMarksDistribution(questionsToCheck, data.totalMarks, isDraft);
  }

  Object.assign(exam, data);
  exam.updatedBy = userId;

  await exam.save();
  logger.info(`Exam updated: ${id} by user ${userId}`);
  return exam;
};

export const deleteExam = async (id, userId) => {
  const exam = await Exam.findOne({ _id: id, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  exam.isDeleted = true;
  exam.updatedBy = userId;

  await exam.save();
  logger.info(`Exam deleted: ${id} by user ${userId}`);
  return exam;
};

export const getInstructions = async (examId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false }).populate(
    "subject",
    "name code"
  );
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  return {
    title: exam.title,
    instructions: exam.instructions,
    allowedMaterials: exam.allowedMaterials,
    examRules: exam.examRules,
    duration: exam.duration,
    totalMarks: exam.totalMarks,
    subject: exam.subject,
  };
};

export const addQuestion = async (examId, questionData, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  exam.questions.push(questionData);
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Question added to exam ${examId} by user ${userId}`);
  return exam;
};

export const updateQuestion = async (examId, questionId, updateData, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  Object.assign(question, updateData);
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Question ${questionId} in exam ${examId} updated by user ${userId}`);
  return exam;
};

export const deleteQuestion = async (examId, questionId, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  question.deleteOne();
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Question ${questionId} deleted from exam ${examId} by user ${userId}`);
  return exam;
};

export const reorderQuestions = async (examId, questionsOrder, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const reordered = [];
  questionsOrder.forEach((id) => {
    const q = exam.questions.id(id);
    if (q) reordered.push(q);
  });

  // Keep any questions that weren't included in the reordered array
  exam.questions.forEach((q) => {
    if (!questionsOrder.includes(q._id.toString())) {
      reordered.push(q);
    }
  });

  exam.questions = reordered;
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Questions in exam ${examId} reordered by user ${userId}`);
  return exam;
};

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
};
