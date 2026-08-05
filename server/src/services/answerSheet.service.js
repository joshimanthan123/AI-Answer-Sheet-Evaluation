import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";
import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";

export const createAnswerSheet = async (data, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: data.student, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate subject exists
  const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  const answerSheet = await AnswerSheet.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return answerSheet;
};

export const getAnswerSheetById = async (id) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false })
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }
  return answerSheet;
};

export const getAllAnswerSheets = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    student,
    subject,
    exam,
    submissionStatus,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (student) {
    mongoQuery.student = student;
  }

  if (subject) {
    mongoQuery.subject = subject;
  }

  if (exam) {
    mongoQuery.exam = exam;
  }

  if (submissionStatus) {
    mongoQuery.submissionStatus = submissionStatus;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await AnswerSheet.countDocuments(mongoQuery);
  const data = await AnswerSheet.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration")
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

export const updateAnswerSheet = async (id, data, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  if (data.student) {
    const student = await User.findOne({
      _id: data.student,
      isDeleted: false,
      role: ROLES.STUDENT,
    });
    if (!student) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Student reference not found or is invalid");
    }
  }

  if (data.subject) {
    const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
    if (!subject) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
    }
  }

  if (data.exam) {
    const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
    }
  }

  Object.assign(answerSheet, data);
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const deleteAnswerSheet = async (id, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  answerSheet.isDeleted = true;
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const startExam = async (examId, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: userId, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  // Verify exam is published
  if (!exam.isPublished) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Exam is not published yet");
  }

  // Verify exam timing (if startTime/endTime are defined)
  const now = new Date();
  if (exam.startTime && now < exam.startTime) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has not started yet");
  }
  if (exam.endTime && now > exam.endTime && !exam.allowLateSubmission) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam submission time has expired");
  }

  // Check if an AnswerSheet for this student and exam already exists
  let answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (answerSheet) {
    // If it exists but is already submitted/completed/evaluated/published, student cannot restart/resume/edit
    if (
      ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
        answerSheet.submissionStatus
      )
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
    }

    // Student resumes existing session
    answerSheet.submissionStatus = "Started";
    await answerSheet.save();
    logger.info(`Student ${userId} resumed exam ${examId}`);
    return answerSheet;
  }

  // Create empty answers array based on the exam questions
  const answers = exam.questions.map((q) => ({
    questionId: q._id,
    handwrittenData: "",
    recognizedText: "",
    hwrStatus: "Pending",
    submissionTime: new Date(),
  }));

  answerSheet = await AnswerSheet.create({
    student: userId,
    subject: exam.subject,
    exam: examId,
    submissionStatus: "Started",
    answers,
    totalQuestions: exam.questions.length,
    createdBy: userId,
    updatedBy: userId,
  });

  // Track event audit log
  logger.info(`Student ${userId} started exam ${examId}`);

  // Create notification for student
  await Notification.create({
    user: userId,
    title: "Exam Started",
    message: `You have successfully started the exam "${exam.title}". All the best!`,
    type: "Exam Started",
    createdBy: userId,
    updatedBy: userId,
  });

  return answerSheet;
};

export const autoSaveAnswer = async (examId, answerData, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot modify answers after final submission");
  }

  const { questionId, handwrittenData, recognizedText, deviceInfo } = answerData;

  const answerIndex = answerSheet.answers.findIndex(
    (ans) => ans.questionId.toString() === questionId
  );

  if (answerIndex > -1) {
    if (handwrittenData !== undefined) {
      answerSheet.answers[answerIndex].handwrittenData = handwrittenData;
    }
    if (recognizedText !== undefined) {
      answerSheet.answers[answerIndex].recognizedText = recognizedText;
    }
    answerSheet.answers[answerIndex].submissionTime = new Date();
    answerSheet.answers[answerIndex].hwrStatus = "Pending";
  } else {
    answerSheet.answers.push({
      questionId,
      handwrittenData: handwrittenData || "",
      recognizedText: recognizedText || "",
      hwrStatus: "Pending",
      submissionTime: new Date(),
    });
  }

  answerSheet.submissionStatus = "Auto Saving";
  answerSheet.lastSavedAt = new Date();
  if (deviceInfo) {
    answerSheet.deviceInfo = deviceInfo;
  }
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const submitExam = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  }).populate("exam", "title createdBy");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
  }

  answerSheet.submissionStatus = "Submitted";
  answerSheet.submittedAt = new Date();
  answerSheet.updatedBy = userId;

  await answerSheet.save();

  logger.info(`Student ${userId} submitted exam ${examId}`);

  // Create notifications
  // 1. Notify Student
  await Notification.create({
    user: userId,
    title: "Exam Submitted",
    message: `Your exam "${answerSheet.exam.title}" was submitted successfully.`,
    type: "Exam Submitted",
    createdBy: userId,
    updatedBy: userId,
  });

  // 2. Notify Faculty Creator
  if (answerSheet.exam.createdBy) {
    await Notification.create({
      user: answerSheet.exam.createdBy,
      title: "New Exam Submission",
      message: `A student has submitted answers for "${answerSheet.exam.title}". Review is pending.`,
      type: "Faculty Review Pending",
      createdBy: userId,
      updatedBy: userId,
    });
  }

  return answerSheet;
};

export const getSubmissionStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  })
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration startTime endTime isPublished");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found for this student and exam");
  }

  return {
    submissionStatus: answerSheet.submissionStatus,
    submittedAt: answerSheet.submittedAt,
    totalQuestions: answerSheet.totalQuestions,
    answersCount: answerSheet.answers.length,
  };
};

export const getReviewStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No exam session found");
  }

  const reviewQuestions = answerSheet.answers.map((ans) => {
    const hasData = !!(ans.handwrittenData || ans.recognizedText);
    return {
      questionId: ans.questionId,
      status: hasData ? "Answered" : "Not Answered",
      lastSavedAt: ans.submissionTime,
    };
  });

  return {
    submissionStatus: answerSheet.submissionStatus,
    lastSavedAt: answerSheet.lastSavedAt,
    reviewQuestions,
  };
};

export default {
  createAnswerSheet,
  getAnswerSheetById,
  getAllAnswerSheets,
  updateAnswerSheet,
  deleteAnswerSheet,
  startExam,
  autoSaveAnswer,
  submitExam,
  getSubmissionStatus,
  getReviewStatus,
};
