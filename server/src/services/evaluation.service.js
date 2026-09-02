import Evaluation from "../models/Evaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";
import evaluationValidator from "../utils/evaluationValidator.js";
import gradingService from "./ai/grading.service.js";

export const createEvaluation = async (data, userId) => {
  // Validate answer sheet exists
  const answerSheet = await AnswerSheet.findOne({ _id: data.answerSheet, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet reference not found or is inactive");
  }

  // Validate Evaluator
  const evaluator = await User.findOne({ _id: data.evaluatedBy, isDeleted: false });
  if (!evaluator) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluator user reference not found or is inactive");
  }

  // Ensure unique evaluation for answer sheet
  const existingEval = await Evaluation.findOne({
    answerSheet: data.answerSheet,
    isDeleted: false,
  });
  if (existingEval) {
    throw new ApiError(
      STATUS_CODES.CONFLICT,
      "An evaluation record already exists for this answer sheet"
    );
  }

  // Math variables
  const obtainedMarks = Number(data.obtainedMarks) || 0;
  const totalMarks = Number(data.totalMarks) || 1;
  const percentage = Number(((obtainedMarks / totalMarks) * 100).toFixed(2));

  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B";
  else if (percentage >= 60) grade = "C";
  else if (percentage >= 50) grade = "D";
  else if (percentage >= 40) grade = "E";

  const evaluationStatus =
    data.evaluationStatus || (data.evaluationType === "Faculty" ? "FACULTY_REVIEW" : "AI_PENDING");

  const evaluation = await Evaluation.create({
    ...data,
    obtainedMarks,
    totalMarks,
    percentage,
    grade,
    evaluationStatus,
    createdBy: userId,
    updatedBy: userId,
  });

  // Automatically update answer sheet status to Completed on successful evaluation
  answerSheet.submissionStatus = "Completed";
  await answerSheet.save();

  return evaluation;
};

export const getEvaluationById = async (id) => {
  const evaluation = await Evaluation.findOne({ _id: id, isDeleted: false })
    .populate({
      path: "answerSheet",
      populate: [
        { path: "student", select: "name email rollNo" },
        { path: "subject", select: "name code" },
        { path: "exam", select: "title totalMarks" },
      ],
    })
    .populate("evaluatedBy", "name email role")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation record not found");
  }
  return evaluation;
};

export const getAllEvaluations = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    evaluatedBy,
    evaluationType,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (evaluatedBy) {
    mongoQuery.evaluatedBy = evaluatedBy;
  }

  if (evaluationType) {
    mongoQuery.evaluationType = evaluationType;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Evaluation.countDocuments(mongoQuery);
  const data = await Evaluation.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate({
      path: "answerSheet",
      populate: [
        { path: "student", select: "name email rollNo" },
        { path: "subject", select: "name code" },
        { path: "exam", select: "title totalMarks" },
      ],
    })
    .populate("evaluatedBy", "name email role")
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

export const updateEvaluation = async (id, data, userId) => {
  const evaluation = await Evaluation.findOne({ _id: id, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation record not found");
  }

  if (data.evaluatedBy) {
    const evaluator = await User.findOne({ _id: data.evaluatedBy, isDeleted: false });
    if (!evaluator) {
      throw new ApiError(
        STATUS_CODES.NOT_FOUND,
        "Evaluator user reference not found or is invalid"
      );
    }
  }

  if (data.obtainedMarks !== undefined || data.totalMarks !== undefined) {
    const obtainedMarks =
      data.obtainedMarks !== undefined ? Number(data.obtainedMarks) : evaluation.obtainedMarks;
    const totalMarks =
      data.totalMarks !== undefined ? Number(data.totalMarks) : evaluation.totalMarks;
    data.percentage = Number(((obtainedMarks / totalMarks) * 100).toFixed(2));

    let grade = "F";
    if (data.percentage >= 90) grade = "A+";
    else if (data.percentage >= 80) grade = "A";
    else if (data.percentage >= 70) grade = "B";
    else if (data.percentage >= 60) grade = "C";
    else if (data.percentage >= 50) grade = "D";
    else if (data.percentage >= 40) grade = "E";
    data.grade = grade;
  }

  Object.assign(evaluation, data);
  evaluation.updatedBy = userId;

  await evaluation.save();
  return evaluation;
};

export const deleteEvaluation = async (id, userId) => {
  const evaluation = await Evaluation.findOne({ _id: id, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation record not found");
  }

  evaluation.isDeleted = true;
  evaluation.updatedBy = userId;

  await evaluation.save();
  return evaluation;
};

export const bulkEvaluate = async (examId, answerSheetIds, userId) => {
  let sheets = [];
  if (answerSheetIds && answerSheetIds.length > 0) {
    sheets = await AnswerSheet.find({
      _id: { $in: answerSheetIds },
      exam: examId,
      isDeleted: false,
    });
  } else {
    sheets = await AnswerSheet.find({
      exam: examId,
      isDeleted: false,
      processingStatus: { $in: ["completed", "ready_for_evaluation"] },
    });
  }

  if (sheets.length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "No eligible answer sheets found for evaluation");
  }

  const results = [];
  for (const sheet of sheets) {
    try {
      const evalObj = await evaluationPipelineService.queueEvaluation(sheet._id, userId);
      results.push({
        answerSheetId: sheet._id,
        success: true,
        evaluationId: evalObj._id,
        status: evalObj.evaluationStatus,
      });
    } catch (err) {
      results.push({
        answerSheetId: sheet._id,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
};

export const reEvaluateAnswerSheet = async (answerSheetId, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false }).populate(
    "exam"
  );
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }
  const exam = ansSheet.exam;
  if (exam && exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this Exam");
  }

  return evaluationPipelineService.queueEvaluation(answerSheetId, userId, {
    scope: "FULL_SHEET",
    reEvaluate: true,
  });
};

export const reEvaluateQuestion = async (answerSheetId, questionNumber, userId) => {
  const ansSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false }).populate(
    "exam"
  );
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }
  const exam = ansSheet.exam;
  if (exam && exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this Exam");
  }

  return evaluationPipelineService.queueEvaluation(answerSheetId, userId, {
    scope: "QUESTION",
    questionNumber,
    reEvaluate: true,
  });
};

export const reviewQuestion = async (evaluationId, questionId, data, userId) => {
  const evaluation = await Evaluation.findOne({ _id: evaluationId, isDeleted: false }).populate({
    path: "answerSheet",
    populate: { path: "exam" },
  });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  const ansSheet = await AnswerSheet.findById(evaluation.answerSheet?._id);
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated answer sheet not found");
  }

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot modify a finalized evaluation");
  }

  const exam = evaluation.answerSheet?.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam details not found");
  }

  if (exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam evaluation");
  }

  // Auto transition review status to IN_PROGRESS if currently ready or revision required
  if (ansSheet.reviewStatus === "READY_FOR_FACULTY_REVIEW" || ansSheet.reviewStatus === "NOT_READY" || ansSheet.reviewStatus === "REVISION_REQUIRED") {
    ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
    ansSheet.reviewedBy = userId;
    ansSheet.reviewStartedAt = new Date();
    
    evaluation.reviewedBy = userId;
    evaluation.reviewStartedAt = new Date();
    evaluation.auditHistory.push({
      action: "REVIEW_STARTED",
      changedBy: userId,
      comment: "Review started automatically via legacy question editor.",
    });
  } else if (ansSheet.reviewStatus !== "FACULTY_REVIEW_IN_PROGRESS" && ansSheet.reviewStatus !== "APPROVED") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer sheet is not in an editable review status.");
  }

  const qEval = evaluation.questions.find(
    (q) =>
      q.questionId.toString() === questionId.toString() ||
      q._id.toString() === questionId.toString()
  );
  if (!qEval) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Question evaluation sub-record not found");
  }

  // Get matching exam question to fetch maxMarks
  const examQuestion = exam.questions.find(
    (eq) => eq._id.toString() === qEval.questionId.toString()
  );
  const maxMarks = examQuestion ? examQuestion.maximumMarks : 10;

  const overrideScore = Number(data.finalAwardedMarks);
  if (isNaN(overrideScore) || overrideScore < 0 || overrideScore > maxMarks) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Overriding marks must be a valid number between 0 and maximum allowed marks (${maxMarks})`
    );
  }

  const previousMarks = qEval.facultyAwardedMarks !== undefined ? qEval.facultyAwardedMarks : null;
  const previousComment = qEval.facultyComment || null;

  qEval.facultyAwardedMarks = overrideScore;
  qEval.finalAwardedMarks = overrideScore;
  qEval.facultyMarks = overrideScore;
  qEval.wasOverridden = true;
  if (data.facultyComment) {
    qEval.facultyComment = data.facultyComment;
    qEval.feedback = `${qEval.feedback || ""} | Faculty comment: ${data.facultyComment}`;
  }
  if (data.overrideReason) {
    qEval.overrideReason = data.overrideReason;
  }

  // Append audit trail log
  evaluation.auditHistory.push({
    action: "MARK_OVERRIDDEN",
    questionNumber: examQuestion ? `Q${examQuestion.questionNumber}` : "Q?",
    previousValue: { marks: previousMarks, comment: previousComment },
    newValue: { marks: overrideScore, comment: data.facultyComment || "" },
    comment: data.overrideReason || "Mark override saved via legacy editor.",
    changedBy: userId,
  });

  // Re-run totals calculation using our validator helper
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);

  evaluation.updatedBy = userId;
  await evaluation.save();

  // Save back to AnswerSheet
  ansSheet.evaluationSummary = summary;
  await ansSheet.save();

  return evaluation;
};

export const finalizeEvaluation = async (evaluationId, userId) => {
  const evaluation = await Evaluation.findOne({ _id: evaluationId, isDeleted: false }).populate({
    path: "answerSheet",
    populate: { path: "exam" },
  });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  const ansSheet = await AnswerSheet.findById(evaluation.answerSheet?._id);
  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated answer sheet not found");
  }

  if (ansSheet.reviewStatus === "FINALIZED") {
    throw new ApiError(STATUS_CODES.CONFLICT, "Evaluation review has already been finalized.");
  }

  const exam = evaluation.answerSheet?.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam details not found");
  }

  if (exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam evaluation");
  }

  // Rebuild final marks and update
  const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);

  ansSheet.reviewStatus = "FINALIZED";
  ansSheet.finalizedAt = new Date();
  ansSheet.finalizedBy = userId;
  ansSheet.submissionStatus = "Completed";
  ansSheet.evaluationSummary = summary;
  ansSheet.resultPublication = {
    status: "READY_FOR_RESULT_PUBLICATION",
    publishedAt: null,
    publishedBy: null,
    unpublishedAt: null,
    unpublishedBy: null,
    publicationComment: null
  };
  await ansSheet.save();

  evaluation.finalizedAt = new Date();
  evaluation.finalizedBy = userId;
  evaluation.obtainedMarks = summary.totalAwardedMarks;
  evaluation.totalMarks = summary.totalMaximumMarks;
  evaluation.percentage = summary.percentage;
  evaluation.grade = gradingService.calculateGrade(summary.percentage);
  evaluation.evaluationStatus = "finalized";

  evaluation.auditHistory.push({
    action: "EVALUATION_FINALIZED",
    comment: "Evaluation review finalized and locked via legacy endpoint.",
    changedBy: userId,
  });
  await evaluation.save();
  return evaluation;
};

export default {
  createEvaluation,
  getEvaluationById,
  getAllEvaluations,
  updateEvaluation,
  deleteEvaluation,
  bulkEvaluate,
  reEvaluateAnswerSheet,
  reEvaluateQuestion,
  reviewQuestion,
  finalizeEvaluation,
};
