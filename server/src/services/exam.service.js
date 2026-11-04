import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";
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
  const subject = await Subject.findOne({ _id: data.subject, isDeleted: { $ne: true } });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
  }

  // Verify subject belongs to the creating faculty
  const creatorUser = await User.findById(userId);
  if (
    creatorUser &&
    creatorUser.role === ROLES.FACULTY &&
    subject.faculty.toString() !== userId.toString()
  ) {
    throw new ApiError(
      STATUS_CODES.FORBIDDEN,
      "Access denied. The specified subject does not belong to your account."
    );
  }

  const { questions = [], ...examData } = data;
  const isDraft = data.examStatus === "Draft";

  // Prevent duplicate examCode for the same faculty creator
  if (data.examCode) {
    const duplicateCode = await Exam.findOne({
      createdBy: userId,
      examCode: data.examCode.toUpperCase(),
      isDeleted: { $ne: true },
    });
    if (duplicateCode) {
      throw new ApiError(STATUS_CODES.CONFLICT, "An exam with this exam code already exists.");
    }
  }

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
    examCode: data.examCode ? data.examCode.toUpperCase() : undefined,
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

export const getExamById = async (id, userId, userRole) => {
  const exam = await Exam.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate("subject", "name code semester faculty")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify ownership if faculty
  const createdByUserId = exam.createdBy && (exam.createdBy._id || exam.createdBy);
  if (
    userRole === ROLES.FACULTY &&
    createdByUserId &&
    createdByUserId.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  return exam;
};

export const getAllExams = async (query = {}, userId, userRole) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sort = "-createdAt",
    subject,
    examType,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: { $ne: true } };

  // Faculty only sees their own exams
  if (userRole === ROLES.FACULTY) {
    mongoQuery.createdBy = userId;
  }

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
  const exam = await Exam.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked" && userId.toString() === exam.createdBy.toString()) {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
  }

  if (data.subject) {
    const subject = await Subject.findOne({ _id: data.subject, isDeleted: { $ne: true } });
    if (!subject) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
    }
    if (
      currentUser &&
      currentUser.role === ROLES.FACULTY &&
      subject.faculty.toString() !== userId.toString()
    ) {
      throw new ApiError(
        STATUS_CODES.FORBIDDEN,
        "Access denied. The specified subject does not belong to your account."
      );
    }
  }

  // Prevent duplicate examCode for the same creator
  if (data.examCode && data.examCode.toUpperCase() !== exam.examCode) {
    const duplicateCode = await Exam.findOne({
      createdBy: userId,
      examCode: data.examCode.toUpperCase(),
      isDeleted: { $ne: true },
      _id: { $ne: id },
    });
    if (duplicateCode) {
      throw new ApiError(STATUS_CODES.CONFLICT, "An exam with this exam code already exists.");
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

  if (data.examCode) {
    data.examCode = data.examCode.toUpperCase();
  }

  Object.assign(exam, data);
  exam.updatedBy = userId;

  await exam.save();
  logger.info(`Exam updated: ${id} by user ${userId}`);
  return exam;
};

export const deleteExam = async (id, userId) => {
  const exam = await Exam.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
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
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
  }

  validateQuestionMarkDistribution({ maximumMarks: questionData.maximumMarks }, questionData);

  exam.questions.push(questionData);
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Question added to exam ${examId} by user ${userId}`);
  return exam;
};

export const updateQuestion = async (examId, questionId, updateData, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  validateQuestionMarkDistribution(question, updateData);

  Object.assign(question, updateData);
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Question ${questionId} in exam ${examId} updated by user ${userId}`);
  return exam;
};

export const deleteQuestion = async (examId, questionId, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
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
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
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

// HELPER: Validate criteria and partial marking distribution bounds
const validateQuestionMarkDistribution = (question, updateData = {}) => {
  let targetCriteria = question.evaluationCriteria || {};
  let targetCriteriaSum = 0;

  const evaluationCriteria = updateData.evaluationCriteria;
  if (evaluationCriteria !== undefined) {
    if (Array.isArray(evaluationCriteria)) {
      const newCriteria = {
        conceptualUnderstanding: 0,
        keywordAccuracy: 0,
        completeness: 0,
        correctness: 0,
      };
      const mapping = {
        "conceptual understanding": "conceptualUnderstanding",
        conceptualunderstanding: "conceptualUnderstanding",
        "keyword accuracy": "keywordAccuracy",
        keywordaccuracy: "keywordAccuracy",
        completeness: "completeness",
        correctness: "correctness",
      };
      for (const item of evaluationCriteria) {
        const key = item.name.trim().toLowerCase();
        const mappedKey = mapping[key] || item.name;
        if (newCriteria[mappedKey] !== undefined) {
          newCriteria[mappedKey] = item.marks;
        }
      }
      targetCriteria = newCriteria;
    } else if (typeof evaluationCriteria === "object" && evaluationCriteria !== null) {
      targetCriteria = {
        conceptualUnderstanding: evaluationCriteria.conceptualUnderstanding || 0,
        keywordAccuracy: evaluationCriteria.keywordAccuracy || 0,
        completeness: evaluationCriteria.completeness || 0,
        correctness: evaluationCriteria.correctness || 0,
      };
    }
    targetCriteriaSum = Object.values(targetCriteria).reduce((sum, v) => sum + (Number(v) || 0), 0);
  } else if (question.evaluationCriteria) {
    targetCriteriaSum =
      (Number(question.evaluationCriteria.conceptualUnderstanding) || 0) +
      (Number(question.evaluationCriteria.keywordAccuracy) || 0) +
      (Number(question.evaluationCriteria.completeness) || 0) +
      (Number(question.evaluationCriteria.correctness) || 0);
  }

  let partialRulesSum = 0;
  const partialMarkingRules = updateData.partialMarkingRules;
  if (partialMarkingRules !== undefined) {
    partialRulesSum = partialMarkingRules.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);
  } else if (question.partialMarkingRules) {
    partialRulesSum = question.partialMarkingRules.reduce(
      (sum, r) => sum + (Number(r.marks) || 0),
      0
    );
  }

  const maxMarks =
    updateData.maximumMarks !== undefined ? updateData.maximumMarks : question.maximumMarks;
  if (targetCriteriaSum > maxMarks) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Total marks configured for evaluation criteria (${targetCriteriaSum}) exceeds the question's maximum marks (${maxMarks}).`
    );
  }

  if (partialRulesSum > maxMarks) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Total marks configured for partial marking rules (${partialRulesSum}) exceeds the question's maximum marks (${maxMarks}).`
    );
  }
};

export const updateQuestionAnswerKey = async (examId, questionId, keyData, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  // Validate mark bounds
  validateQuestionMarkDistribution(question, keyData);

  // Apply map logic for evaluation criteria array if sent that way
  let targetCriteria = question.evaluationCriteria || {};
  if (keyData.evaluationCriteria !== undefined) {
    if (Array.isArray(keyData.evaluationCriteria)) {
      const newCriteria = {
        conceptualUnderstanding: 0,
        keywordAccuracy: 0,
        completeness: 0,
        correctness: 0,
      };

      const mapping = {
        "conceptual understanding": "conceptualUnderstanding",
        conceptualunderstanding: "conceptualUnderstanding",
        "keyword accuracy": "keywordAccuracy",
        keywordaccuracy: "keywordAccuracy",
        completeness: "completeness",
        correctness: "correctness",
      };

      for (const item of keyData.evaluationCriteria) {
        const key = item.name.trim().toLowerCase();
        const mappedKey = mapping[key] || item.name;
        if (newCriteria[mappedKey] !== undefined) {
          newCriteria[mappedKey] = item.marks;
        }
      }
      targetCriteria = newCriteria;
    } else if (
      typeof keyData.evaluationCriteria === "object" &&
      keyData.evaluationCriteria !== null
    ) {
      targetCriteria = {
        conceptualUnderstanding: keyData.evaluationCriteria.conceptualUnderstanding || 0,
        keywordAccuracy: keyData.evaluationCriteria.keywordAccuracy || 0,
        completeness: keyData.evaluationCriteria.completeness || 0,
        correctness: keyData.evaluationCriteria.correctness || 0,
      };
    }
  }

  // Update properties
  if (keyData.modelAnswer !== undefined) {
    question.modelAnswer = keyData.modelAnswer.trim();
  }
  if (keyData.keywords !== undefined) {
    const cleanedKeywords = [
      ...new Set(keyData.keywords.map((k) => k.trim()).filter((k) => k.length > 0)),
    ];
    question.keywords = cleanedKeywords;
  }
  if (keyData.expectedAnswerLength !== undefined) {
    question.expectedAnswerLength = keyData.expectedAnswerLength;
  }
  if (keyData.evaluationCriteria !== undefined) {
    question.evaluationCriteria = targetCriteria;
  }
  if (keyData.partialMarkingRules !== undefined) {
    question.partialMarkingRules = keyData.partialMarkingRules;
  }

  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Answer key updated for question ${questionId} in exam ${examId} by user ${userId}`);
  return exam;
};

export const finalizeAnswerKey = async (examId, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  if (exam.answerKeyStatus === "locked") {
    return exam;
  }

  // Completeness check
  const incompleteQuestions = [];

  if (!exam.questions || exam.questions.length === 0) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Answer key cannot be finalized because this exam has no questions."
    );
  }

  for (const q of exam.questions) {
    const issues = [];
    if (!q.questionText || q.questionText.trim().length === 0) {
      issues.push("Question text is missing");
    }
    if (!q.maximumMarks || q.maximumMarks <= 0) {
      issues.push("Maximum marks is invalid");
    }
    if (!q.modelAnswer || q.modelAnswer.trim().length === 0) {
      issues.push("Model answer is missing");
    }

    const criteriaSum = q.evaluationCriteria
      ? (Number(q.evaluationCriteria.conceptualUnderstanding) || 0) +
        (Number(q.evaluationCriteria.keywordAccuracy) || 0) +
        (Number(q.evaluationCriteria.completeness) || 0) +
        (Number(q.evaluationCriteria.correctness) || 0)
      : 0;

    const partialSum = (q.partialMarkingRules || []).reduce(
      (sum, r) => sum + (Number(r.marks) || 0),
      0
    );

    if (criteriaSum > q.maximumMarks) {
      issues.push(
        `Evaluation criteria total (${criteriaSum}) exceeds question maximum marks (${q.maximumMarks})`
      );
    }

    if (partialSum > q.maximumMarks) {
      issues.push(
        `Partial marking rules total (${partialSum}) exceeds question maximum marks (${q.maximumMarks})`
      );
    }

    if (issues.length > 0) {
      incompleteQuestions.push({
        questionNumber: q.questionNumber,
        questionId: q._id,
        issues,
      });
    }
  }

  if (incompleteQuestions.length > 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer key is incomplete", incompleteQuestions);
  }

  exam.answerKeyStatus = "locked";
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Answer key finalized and locked for exam ${examId} by user ${userId}`);
  return exam;
};

export const unlockAnswerKey = async (examId, userId, userRole) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify authorization: only owner or Admin can unlock
  const currentUser = await User.findById(userId);
  const isOwner = exam.createdBy.toString() === userId.toString();
  const isAdmin = userRole === ROLES.ADMIN || (currentUser && currentUser.role === ROLES.ADMIN);

  if (!isOwner && !isAdmin) {
    throw new ApiError(
      STATUS_CODES.FORBIDDEN,
      "Access denied. You do not have permission to unlock this answer key."
    );
  }

  exam.answerKeyStatus = "draft";
  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Answer key unlocked for exam ${examId} by user ${userId}`);
  return exam;
};

export const getEvaluationConfig = async (examId, questionId, userId, userRole) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify authorization: faculty owner or admin
  const currentUser = await User.findById(userId);
  if (
    userRole === ROLES.FACULTY &&
    currentUser &&
    exam.createdBy &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  const config = question.evaluationConfig && question.evaluationConfig.rubric && question.evaluationConfig.rubric.length > 0
    ? question.evaluationConfig
    : {
        version: 1,
        modelAnswer: question.modelAnswer || "",
        rubric: (question.rubricItems || []).map((r) => ({
          criterion: r.criterion,
          description: r.description || "",
          maxMarks: r.maxMarks,
        })),
      };

  return {
    examId: exam._id,
    questionId: question._id,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    questionType: question.questionType || "descriptive",
    maximumMarks: question.maximumMarks,
    evaluationConfig: config,
  };
};

export const saveEvaluationConfig = async (examId, questionId, data, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Validate ownership
  const currentUser = await User.findById(userId);
  if (
    currentUser &&
    currentUser.role === ROLES.FACULTY &&
    exam.createdBy.toString() !== userId.toString()
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Check lock state
  if (exam.answerKeyStatus === "locked") {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "This exam's answer key is locked and cannot be modified."
    );
  }

  const question = exam.questions.id(questionId);
  if (!question) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in the exam");
  }

  // 1. Question text required
  const questionText = data.questionText !== undefined ? data.questionText : question.questionText;
  if (!questionText || questionText.trim().length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Question text is required");
  }

  // 2. maxMarks must be > 0
  const maxMarks = Number(data.maximumMarks !== undefined ? data.maximumMarks : (data.maxMarks !== undefined ? data.maxMarks : question.maximumMarks));
  if (isNaN(maxMarks) || maxMarks <= 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Maximum marks must be greater than 0");
  }

  // 3. Model answer required when saving evaluationConfig
  const modelAnswer = data.modelAnswer !== undefined ? data.modelAnswer : (data.evaluationConfig?.modelAnswer || question.modelAnswer || "");
  if (!modelAnswer || modelAnswer.trim().length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Model answer is required for evaluation configuration");
  }

  // 4. Rubric criterion required, description required, maxMarks > 0
  const rubricInput = data.rubric || data.evaluationConfig?.rubric || (Array.isArray(data.rubricItems) ? data.rubricItems : []);
  if (!Array.isArray(rubricInput) || rubricInput.length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Evaluation rubric requires at least one criterion");
  }

  let rubricTotal = 0;
  const cleanedRubric = [];
  for (let i = 0; i < rubricInput.length; i++) {
    const item = rubricInput[i];
    if (!item.criterion || item.criterion.trim().length === 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, `Rubric item #${i + 1} criterion name is required`);
    }
    if (!item.description || item.description.trim().length === 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, `Rubric item #${i + 1} (${item.criterion}) description is required`);
    }
    const itemMarks = Number(item.maxMarks !== undefined ? item.maxMarks : item.marks);
    if (isNaN(itemMarks) || itemMarks <= 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, `Rubric item #${i + 1} (${item.criterion}) marks must be greater than 0`);
    }
    rubricTotal += itemMarks;
    cleanedRubric.push({
      criterion: item.criterion.trim(),
      description: item.description.trim(),
      maxMarks: itemMarks,
    });
  }

  // 5. Rubric total sum must equal maximumMarks
  rubricTotal = Number(rubricTotal.toFixed(4));
  const targetMaxMarks = Number(maxMarks.toFixed(4));

  if (rubricTotal !== targetMaxMarks) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Rubric total (${rubricTotal}) must equal question maximum marks (${targetMaxMarks})`
    );
  }

  // Determine Versioning:
  // Initial save of evaluation config = version 1.
  // Subsequent updates = version increment.
  let newVersion = 1;
  const hasExistingConfig =
    question.evaluationConfig &&
    (
      (Array.isArray(question.evaluationConfig.rubric) && question.evaluationConfig.rubric.length > 0) ||
      (question.evaluationConfig.modelAnswer && question.evaluationConfig.modelAnswer.trim().length > 0)
    );

  if (hasExistingConfig) {
    const currentVersion = Number(question.evaluationConfig.version) || 1;
    newVersion = currentVersion + 1;
  } else {
    newVersion = 1;
  }

  // Apply updates to question document
  question.questionText = questionText.trim();
  question.maximumMarks = maxMarks;
  if (data.questionType) {
    question.questionType = data.questionType;
  }
  question.modelAnswer = modelAnswer.trim();
  question.rubricItems = cleanedRubric;

  question.evaluationConfig = {
    version: newVersion,
    modelAnswer: modelAnswer.trim(),
    rubric: cleanedRubric,
  };

  exam.updatedBy = userId;
  await exam.save();

  logger.info(`Evaluation config saved for question ${questionId} in exam ${examId} (Version ${newVersion}) by user ${userId}`);

  return {
    exam,
    questionId: question._id,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    questionType: question.questionType,
    maximumMarks: question.maximumMarks,
    evaluationConfig: question.evaluationConfig,
  };
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
  updateQuestionAnswerKey,
  finalizeAnswerKey,
  unlockAnswerKey,
  getEvaluationConfig,
  saveEvaluationConfig,
};
