import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { validateAccess } from "./facultyReview.service.js";
import logger from "../utils/logger.js";

/**
 * Retrieves finalized answer sheets that are ready to be published.
 * @param {object} filters Course, exam, student, and pagination filters.
 * @param {string} userId Faculty ID.
 */
export const getPublishableResults = async (filters = {}, userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "User not found");
  }

  const query = {
    isDeleted: false,
    reviewStatus: "FINALIZED",
    "resultPublication.status": { $ne: "RESULT_PUBLISHED" }
  };

  // Enforce exam ownership for faculty members
  if (user.role !== "admin") {
    const exams = await Exam.find({ createdBy: userId, isDeleted: false });
    const examIds = exams.map((e) => e._id);
    query.exam = { $in: examIds };
  }

  // Parse filters
  if (filters.examId) query.exam = filters.examId;
  if (filters.studentId) query.student = filters.studentId;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await AnswerSheet.countDocuments(query);
  const sheets = await AnswerSheet.find(query)
    .sort("-finalizedAt")
    .skip(skip)
    .limit(limit)
    .populate("student", "name email rollNo department")
    .populate("exam", "title totalMarks");

  const data = [];
  for (const as of sheets) {
    const evaluation = await Evaluation.findOne({ answerSheet: as._id, isDeleted: false });
    data.push({
      answerSheetId: as._id,
      student: as.student
        ? {
            id: as.student._id,
            name: as.student.name,
            email: as.student.email,
            rollNo: as.student.rollNo,
            department: as.student.department,
          }
        : null,
      exam: as.exam
        ? {
            id: as.exam._id,
            title: as.exam.title,
            totalMarks: as.exam.totalMarks,
          }
        : null,
      reviewStatus: as.reviewStatus,
      publicationStatus: as.resultPublication?.status || "NOT_READY",
      totalFinalMarks: as.evaluationSummary?.totalAwardedMarks || evaluation?.obtainedMarks || 0,
      maximumMarks: as.evaluationSummary?.totalMaximumMarks || evaluation?.totalMarks || 10,
      percentage: as.evaluationSummary?.percentage || evaluation?.percentage || 0,
      grade: evaluation?.grade || "F",
      finalizedAt: as.finalizedAt || as.updatedAt,
    });
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Retrieves already published answer sheets under the faculty's control.
 * @param {object} filters Course, exam, student, and pagination filters.
 * @param {string} userId Faculty ID.
 */
export const getPublishedResults = async (filters = {}, userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "User not found");
  }

  const query = {
    isDeleted: false,
    "resultPublication.status": "RESULT_PUBLISHED"
  };

  if (user.role !== "admin") {
    const exams = await Exam.find({ createdBy: userId, isDeleted: false });
    const examIds = exams.map((e) => e._id);
    query.exam = { $in: examIds };
  }

  if (filters.examId) query.exam = filters.examId;
  if (filters.studentId) query.student = filters.studentId;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await AnswerSheet.countDocuments(query);
  const sheets = await AnswerSheet.find(query)
    .sort("-resultPublication.publishedAt")
    .skip(skip)
    .limit(limit)
    .populate("student", "name email rollNo department")
    .populate("exam", "title totalMarks");

  const data = [];
  for (const as of sheets) {
    const evaluation = await Evaluation.findOne({ answerSheet: as._id, isDeleted: false });
    data.push({
      answerSheetId: as._id,
      student: as.student
        ? {
            id: as.student._id,
            name: as.student.name,
            email: as.student.email,
            rollNo: as.student.rollNo,
            department: as.student.department,
          }
        : null,
      exam: as.exam
        ? {
            id: as.exam._id,
            title: as.exam.title,
            totalMarks: as.exam.totalMarks,
          }
        : null,
      reviewStatus: as.reviewStatus,
      publicationStatus: as.resultPublication?.status || "NOT_READY",
      totalFinalMarks: as.evaluationSummary?.totalAwardedMarks || evaluation?.obtainedMarks || 0,
      maximumMarks: as.evaluationSummary?.totalMaximumMarks || evaluation?.totalMarks || 10,
      percentage: as.evaluationSummary?.percentage || evaluation?.percentage || 0,
      grade: evaluation?.grade || "F",
      publishedAt: as.resultPublication?.publishedAt,
      publishedBy: as.resultPublication?.publishedBy,
    });
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Publishes the result of a finalized answer sheet.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} facultyId User ID of the faculty member publishing the result.
 * @param {string} comment Optional comment.
 */
export const publishResult = async (answerSheetId, facultyId, comment = "") => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, facultyId);

  // Validate state - must be finalized
  if (ansSheet.reviewStatus !== "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "RESULT_NOT_FINALIZED: Results can only be published after review is fully finalized.");
  }

  if (ansSheet.resultPublication?.status === "RESULT_PUBLISHED") {
    throw new ApiError(STATUS_CODES.CONFLICT, "RESULT_ALREADY_PUBLISHED: The result has already been published.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated evaluation not found.");
  }

  // Set publication values
  ansSheet.resultPublication = {
    status: "RESULT_PUBLISHED",
    publishedAt: new Date(),
    publishedBy: facultyId,
    unpublishedAt: ansSheet.resultPublication?.unpublishedAt || null,
    unpublishedBy: ansSheet.resultPublication?.unpublishedBy || null,
    publicationComment: comment || "Result published."
  };
  
  // reviewStatus remains FINALIZED for separation of role concerns
  await ansSheet.save();

  // Update evaluation status as well and log audit trail
  const previousStatus = ansSheet.resultPublication?.status || "READY_FOR_RESULT_PUBLICATION";
  evaluation.evaluationStatus = "PUBLISHED";
  evaluation.auditHistory.push({
    action: "RESULT_PUBLISHED",
    previousValue: { status: previousStatus },
    newValue: { status: "RESULT_PUBLISHED" },
    comment: comment || "Results released after final faculty approval.",
    changedBy: facultyId,
  });
  await evaluation.save();

  logger.info(`Faculty ${facultyId} published results for AnswerSheet ${answerSheetId}`);

  return {
    success: true,
    message: "Result published successfully.",
    data: {
      answerSheetId: ansSheet._id,
      publicationStatus: "RESULT_PUBLISHED",
      publishedAt: ansSheet.resultPublication.publishedAt,
      totalMarks: ansSheet.evaluationSummary?.totalAwardedMarks || evaluation.obtainedMarks,
      maximumMarks: ansSheet.evaluationSummary?.totalMaximumMarks || evaluation.totalMarks,
      percentage: ansSheet.evaluationSummary?.percentage || evaluation.percentage,
      grade: evaluation.grade
    }
  };
};

/**
 * Unpublishes a published result to immediately hide it from students.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} facultyId User ID of the faculty member unpublishing.
 * @param {string} reason Justification for unpublishing.
 */
export const unpublishResult = async (answerSheetId, facultyId, reason = "") => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, facultyId);

  if (ansSheet.resultPublication?.status !== "RESULT_PUBLISHED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "RESULT_NOT_PUBLISHED: The result is not currently published.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated evaluation not found.");
  }

  const previousStatus = ansSheet.resultPublication?.status || "RESULT_PUBLISHED";

  ansSheet.resultPublication.status = "RESULT_UNPUBLISHED";
  ansSheet.resultPublication.unpublishedAt = new Date();
  ansSheet.resultPublication.unpublishedBy = facultyId;
  ansSheet.resultPublication.publicationComment = reason || "Result unpublished.";
  
  // Transition reviewStatus back to FINALIZED to reflect they can republish later
  ansSheet.reviewStatus = "FINALIZED";
  await ansSheet.save();

  evaluation.evaluationStatus = "finalized";
  evaluation.auditHistory.push({
    action: "RESULT_UNPUBLISHED",
    previousValue: { status: previousStatus },
    newValue: { status: "RESULT_UNPUBLISHED" },
    comment: reason || "Results unpublished. Student access blocked.",
    changedBy: facultyId,
  });
  await evaluation.save();

  logger.info(`Faculty ${facultyId} unpublished results for AnswerSheet ${answerSheetId}`);

  return {
    success: true,
    message: "Result unpublished successfully.",
    data: {
      answerSheetId: ansSheet._id,
      publicationStatus: "RESULT_UNPUBLISHED",
      unpublishedAt: ansSheet.resultPublication.unpublishedAt
    }
  };
};

/**
 * Gets result publication status.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} facultyId Faculty ID.
 */
export const getPublicationStatus = async (answerSheetId, facultyId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found.");
  }

  await validateAccess(ansSheet, facultyId);

  return {
    answerSheetId: ansSheet._id,
    reviewStatus: ansSheet.reviewStatus,
    publication: ansSheet.resultPublication || { status: "NOT_READY" }
  };
};

export default {
  getPublishableResults,
  getPublishedResults,
  publishResult,
  unpublishResult,
  getPublicationStatus,
};
