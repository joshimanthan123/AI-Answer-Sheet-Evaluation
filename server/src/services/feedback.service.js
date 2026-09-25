import EvaluationFeedback from "../models/EvaluationFeedback.js";
import Evaluation from "../models/Evaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Exam from "../models/Exam.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";

/**
 * Maps faculty override reason to structured feedbackType.
 */
export const mapReasonToFeedbackType = (reason) => {
  if (!reason) return "mark_correction";
  const r = reason.toLowerCase();
  if (r.includes("alternative") || r.includes("different wording")) return "alternative_answer";
  if (r.includes("ocr") || r.includes("text recognition")) return "OCR_issue";
  if (r.includes("rubric")) return "rubric_issue";
  if (r.includes("reference") || r.includes("model answer")) return "reference_answer_issue";
  if (r.includes("underestimated") || r.includes("overestimated") || r.includes("partial")) return "mark_correction";
  if (r.includes("logic") || r.includes("concept")) return "evaluation_logic_issue";
  return "other";
};

/**
 * Creates or updates an EvaluationFeedback document for a faculty override.
 */
export const recordOverrideFeedback = async (params) => {
  const {
    evaluationId,
    answerSheetId,
    examId,
    questionId,
    questionNumber,
    studentId,
    aiMarks,
    finalMarks,
    reason,
    comment,
    aiConfidence,
    ocrConfidence,
    userId,
  } = params;

  if (!evaluationId || !examId || finalMarks === undefined || aiMarks === undefined || !reason) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Missing required fields for recording feedback.");
  }

  const difference = Number((finalMarks - aiMarks).toFixed(2));
  const feedbackType = mapReasonToFeedbackType(reason);

  const existingFeedback = await EvaluationFeedback.findOne({
    evaluationId,
    questionNumber: String(questionNumber),
    isDeleted: false,
  });

  if (existingFeedback) {
    existingFeedback.aiMarks = aiMarks;
    existingFeedback.finalMarks = finalMarks;
    existingFeedback.difference = difference;
    existingFeedback.feedbackType = feedbackType;
    existingFeedback.reason = reason;
    existingFeedback.comment = comment || "";
    existingFeedback.aiConfidence = aiConfidence || existingFeedback.aiConfidence;
    existingFeedback.createdBy = userId;
    await existingFeedback.save();
    logger.info(`Updated feedback record for evaluation ${evaluationId}, Q${questionNumber}`);
    return existingFeedback;
  }

  const newFeedback = await EvaluationFeedback.create({
    evaluationId,
    answerSheetId,
    examId,
    questionId,
    questionNumber: String(questionNumber),
    studentId,
    aiMarks,
    finalMarks,
    difference,
    feedbackType,
    reason,
    comment: comment || "",
    aiConfidence: aiConfidence || 0,
    ocrConfidence: ocrConfidence || 0,
    createdBy: userId,
  });

  logger.info(`Created new evaluation feedback record for evaluation ${evaluationId}, Q${questionNumber}`);
  return newFeedback;
};

/**
 * Retrieves paginated feedback history with search/filter capabilities.
 */
export const getFeedbackHistory = async (query = {}, requestingUser) => {
  const { examId, questionNumber, feedbackType, facultyId, startDate, endDate, page = 1, limit = 10 } = query;

  const filter = { isDeleted: false };

  // Faculty access control: if faculty role, restrict to exams created by them unless admin
  if (requestingUser.role === "faculty") {
    const facultyExams = await Exam.find({ createdBy: requestingUser._id, isDeleted: false }).select("_id");
    const examIds = facultyExams.map((e) => e._id);
    filter.examId = { $in: examIds };
  }

  if (examId) {
    filter.examId = examId;
  }
  if (questionNumber) {
    filter.questionNumber = String(questionNumber);
  }
  if (feedbackType) {
    filter.feedbackType = feedbackType;
  }
  if (facultyId) {
    filter.createdBy = facultyId;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = eDate;
    }
  }

  const limitNum = parseInt(limit) || 10;
  const pageNum = parseInt(page) || 1;
  const skip = (pageNum - 1) * limitNum;

  const total = await EvaluationFeedback.countDocuments(filter);
  const items = await EvaluationFeedback.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limitNum)
    .populate("examId", "title totalMarks")
    .populate("createdBy", "name email role")
    .populate("studentId", "name rollNo email")
    .lean();

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Exports feedback history in CSV format.
 */
export const exportFeedbackCSV = async (query = {}, requestingUser) => {
  const result = await getFeedbackHistory({ ...query, limit: 5000, page: 1 }, requestingUser);
  const items = result.items || [];

  const headers = [
    "Exam",
    "Question",
    "AI Marks",
    "Final Marks",
    "Difference",
    "Feedback Type",
    "Reason",
    "Faculty Comment",
    "AI Confidence",
    "Created By",
    "Created At",
  ];

  const rows = items.map((item) => [
    `"${item.examId?.title || "Exam"}"`,
    `"Q${item.questionNumber || "N/A"}"`,
    item.aiMarks ?? 0,
    item.finalMarks ?? 0,
    item.difference >= 0 ? `+${item.difference}` : item.difference,
    `"${item.feedbackType || ""}"`,
    `"${(item.reason || "").replace(/"/g, '""')}"`,
    `"${(item.comment || "").replace(/"/g, '""')}"`,
    item.aiConfidence ? `${(item.aiConfidence * 100).toFixed(0)}%` : "N/A",
    `"${item.createdBy?.name || "Faculty"}"`,
    `"${new Date(item.createdAt).toISOString()}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
};

export default {
  mapReasonToFeedbackType,
  recordOverrideFeedback,
  getFeedbackHistory,
  exportFeedbackCSV,
};
