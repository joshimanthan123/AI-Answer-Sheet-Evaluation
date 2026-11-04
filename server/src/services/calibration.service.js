import EvaluationFeedback from "../models/EvaluationFeedback.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";

/**
 * Builds standard MongoDB filter for calibration queries based on user role and query parameters.
 */
const buildCalibrationFilter = async (query = {}, requestingUser) => {
  const filter = { isDeleted: false };

  if (requestingUser.role === "faculty") {
    const facultyExams = await Exam.find({ createdBy: requestingUser._id, isDeleted: false }).select("_id");
    const examIds = facultyExams.map((e) => e._id);
    filter.examId = { $in: examIds };
  }

  if (query.examId) filter.examId = query.examId;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.questionNumber) filter.questionNumber = String(query.questionNumber);
  if (query.reviewStatus) filter.reviewStatus = query.reviewStatus;
  if (query.reviewCategory) filter.reviewCategory = query.reviewCategory;
  if (query.referenceUsed !== undefined && query.referenceUsed !== "") {
    filter.referenceUsed = String(query.referenceUsed) === "true";
  }

  if (query.minConfidence !== undefined || query.maxConfidence !== undefined) {
    filter.aiConfidence = {};
    if (query.minConfidence !== undefined) filter.aiConfidence.$gte = Number(query.minConfidence);
    if (query.maxConfidence !== undefined) filter.aiConfidence.$lte = Number(query.maxConfidence);
  }

  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) {
      const eDate = new Date(query.endDate);
      eDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = eDate;
    }
  }

  return filter;
};

/**
 * 1. GET /api/v1/calibration/summary
 * Generates high-level descriptive calibration statistics.
 */
export const getCalibrationSummary = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);
  const items = await EvaluationFeedback.find(filter).lean();

  const totalReviewed = items.length;

  if (totalReviewed === 0) {
    return {
      hasData: false,
      message: "No calibration data available yet.",
      totalReviewed: 0,
      approvedCount: 0,
      modifiedCount: 0,
      rejectedCount: 0,
      averageAiMarks: 0,
      averageFacultyMarks: 0,
      averageAbsoluteDifference: 0,
      averageDifference: 0,
      modificationRate: 0,
      confidenceDistribution: [],
    };
  }

  let approvedCount = 0;
  let modifiedCount = 0;
  let rejectedCount = 0;
  let sumAiMarks = 0;
  let sumFacultyMarks = 0;
  let sumAbsDiff = 0;
  let sumDiff = 0;

  items.forEach((item) => {
    sumAiMarks += item.aiMarks || 0;
    sumFacultyMarks += item.finalMarks || 0;
    const diff = item.difference !== undefined ? item.difference : (item.finalMarks - item.aiMarks);
    sumDiff += diff;
    sumAbsDiff += Math.abs(diff);

    const status = (item.reviewStatus || "").toUpperCase();
    if (status === "APPROVED" || diff === 0) {
      approvedCount++;
    } else if (status === "REJECTED" || (item.finalMarks === 0 && item.aiMarks > 0)) {
      rejectedCount++;
    } else {
      modifiedCount++;
    }
  });

  const averageAiMarks = Number((sumAiMarks / totalReviewed).toFixed(2));
  const averageFacultyMarks = Number((sumFacultyMarks / totalReviewed).toFixed(2));
  const averageAbsoluteDifference = Number((sumAbsDiff / totalReviewed).toFixed(2));
  const averageDifference = Number((sumDiff / totalReviewed).toFixed(2));
  const modificationRate = Number(((modifiedCount + rejectedCount) / totalReviewed * 100).toFixed(1));

  // Confidence distribution breakdown
  const confBuckets = { "0-20%": 0, "20-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0 };
  items.forEach((item) => {
    const c = (item.aiConfidence || 0) * 100;
    if (c <= 20) confBuckets["0-20%"]++;
    else if (c <= 40) confBuckets["20-40%"]++;
    else if (c <= 60) confBuckets["40-60%"]++;
    else if (c <= 80) confBuckets["60-80%"]++;
    else confBuckets["80-100%"]++;
  });

  const confidenceDistribution = Object.entries(confBuckets).map(([range, count]) => ({
    range,
    count,
    percentage: Number(((count / totalReviewed) * 100).toFixed(1)),
  }));

  return {
    hasData: true,
    totalReviewed,
    approvedCount,
    modifiedCount,
    rejectedCount,
    averageAiMarks,
    averageFacultyMarks,
    averageAbsoluteDifference,
    averageDifference,
    modificationRate,
    confidenceDistribution,
  };
};

/**
 * 2. GET /api/v1/calibration/by-question
 * Analyzes calibration statistics broken down by Question.
 */
export const getQuestionLevelCalibration = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);
  const items = await EvaluationFeedback.find(filter)
    .populate("examId", "title")
    .populate("subjectId", "name code")
    .lean();

  if (items.length === 0) {
    return { hasData: false, message: "No calibration data available yet.", questions: [] };
  }

  const groupMap = new Map();

  items.forEach((item) => {
    const qKey = `${item.examId?._id || "exam"}_${item.questionNumber}`;
    if (!groupMap.has(qKey)) {
      groupMap.set(qKey, {
        examId: item.examId?._id,
        examTitle: item.examId?.title || "Exam",
        questionNumber: item.questionNumber,
        subjectName: item.subjectId?.name || "Subject",
        reviews: [],
      });
    }
    groupMap.get(qKey).reviews.push(item);
  });

  const questions = Array.from(groupMap.values()).map((grp) => {
    const total = grp.reviews.length;
    let sumAi = 0;
    let sumFaculty = 0;
    let modified = 0;
    let approved = 0;

    grp.reviews.forEach((r) => {
      sumAi += r.aiMarks || 0;
      sumFaculty += r.finalMarks || 0;
      if (r.difference === 0 || r.reviewStatus === "APPROVED") approved++;
      else modified++;
    });

    return {
      examTitle: grp.examTitle,
      questionNumber: grp.questionNumber,
      totalReviews: total,
      approvedCount: approved,
      modifiedCount: modified,
      aiAverageMarks: Number((sumAi / total).toFixed(2)),
      facultyAverageMarks: Number((sumFaculty / total).toFixed(2)),
      averageDifference: Number(((sumFaculty - sumAi) / total).toFixed(2)),
      modificationRate: Number(((modified / total) * 100).toFixed(1)),
    };
  });

  return { hasData: true, questions };
};

/**
 * 3. GET /api/v1/calibration/by-confidence
 * Confidence Range vs Modification Rate Analysis.
 */
export const getConfidenceVsCorrection = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);
  const items = await EvaluationFeedback.find(filter).lean();

  if (items.length < 3) {
    return {
      hasData: false,
      message: "Insufficient review data.",
      ranges: [],
    };
  }

  const rangesDef = [
    { label: "0–20%", min: 0, max: 0.20 },
    { label: "20–40%", min: 0.20, max: 0.40 },
    { label: "40–60%", min: 0.40, max: 0.60 },
    { label: "60–80%", min: 0.60, max: 0.80 },
    { label: "80–100%", min: 0.80, max: 1.0 },
  ];

  const ranges = rangesDef.map((rDef) => {
    const matching = items.filter((item) => {
      const conf = item.aiConfidence || 0;
      if (rDef.max === 1.0) return conf >= rDef.min && conf <= rDef.max;
      return conf >= rDef.min && conf < rDef.max;
    });

    const reviews = matching.length;
    const modified = matching.filter((item) => item.difference !== 0 || item.reviewStatus === "MODIFIED").length;
    const modificationRate = reviews > 0 ? Number(((modified / reviews) * 100).toFixed(1)) : 0;

    return {
      confidenceRange: rDef.label,
      reviews,
      modified,
      modificationRate,
    };
  });

  return { hasData: true, ranges };
};

/**
 * 4. GET /api/v1/calibration/reference-impact
 * Evaluates modification rate comparing reference-assisted vs unassisted evaluations.
 */
export const getReferenceEffectAnalysis = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);
  const items = await EvaluationFeedback.find(filter).lean();

  if (items.length === 0) {
    return {
      hasData: false,
      message: "Insufficient data for this analysis.",
      referenceUsed: { reviewed: 0, modified: 0, modificationRate: 0 },
      referenceNotUsed: { reviewed: 0, modified: 0, modificationRate: 0 },
    };
  }

  const refUsedItems = items.filter((i) => i.referenceUsed === true);
  const refNotUsedItems = items.filter((i) => i.referenceUsed !== true);

  const calcStats = (list) => {
    const reviewed = list.length;
    const modified = list.filter((i) => i.difference !== 0 || i.reviewStatus === "MODIFIED").length;
    const modificationRate = reviewed > 0 ? Number(((modified / reviewed) * 100).toFixed(1)) : 0;
    return { reviewed, modified, modificationRate };
  };

  return {
    hasData: true,
    note: "Observed Faculty modification rate based on reference usage.",
    referenceUsed: calcStats(refUsedItems),
    referenceNotUsed: calcStats(refNotUsedItems),
  };
};

/**
 * 5. GET /api/v1/calibration/insights
 * Generates factual insights and prompt calibration recommendations.
 */
export const getCalibrationInsights = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);
  const items = await EvaluationFeedback.find(filter).lean();

  if (items.length === 0) {
    return {
      hasData: false,
      message: "No calibration data available yet.",
      insights: [],
      recommendations: [],
    };
  }

  const insights = [];
  const recommendations = [];

  // Category counts
  const categoryCounts = {};
  let ocrCorrections = 0;
  let missingConceptCount = 0;
  let highConfCount = 0;

  items.forEach((item) => {
    const cat = item.reviewCategory || item.reason || "Other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    if (cat.toLowerCase().includes("ocr") || item.feedbackType === "OCR_issue") {
      ocrCorrections++;
    }
    if (cat.toLowerCase().includes("missing concept") || (item.missingConcepts && item.missingConcepts.length > 0)) {
      missingConceptCount++;
    }
    if ((item.aiConfidence || 0) >= 0.7) {
      highConfCount++;
    }
  });

  if (missingConceptCount > 0) {
    insights.push(`${missingConceptCount} evaluation(s) were modified because Faculty identified missing concepts.`);
  }

  if (ocrCorrections > 0) {
    insights.push(`${ocrCorrections} evaluation(s) had OCR-related corrections.`);
  }

  if (highConfCount > 0) {
    const pct = ((highConfCount / items.length) * 100).toFixed(0);
    insights.push(`${pct}% of reviewed answers in this dataset had AI confidence above 70%.`);
  }

  // Generate factual prompt calibration recommendations without auto-modifying prompts
  if (categoryCounts["AI overestimated"] > 2) {
    recommendations.push("Review rubric grading strictness: Multiple evaluations were modified due to AI overestimation.");
  }
  if (categoryCounts["AI underestimated"] > 2) {
    recommendations.push("Review keyword weighting: Multiple evaluations were modified due to AI underestimation of partial credit.");
  }
  if (categoryCounts["Missing concept"] > 2) {
    recommendations.push("Review rubric instruction regarding conceptual explanation vs keyword matching.");
  }

  if (insights.length === 0) {
    insights.push(`Total ${items.length} evaluation review record(s) processed for calibration analysis.`);
  }

  return {
    hasData: true,
    totalRecords: items.length,
    insights,
    recommendations,
  };
};

/**
 * 6. GET /api/v1/calibration/feedback
 * Retrieves paginated feedback records eligible for learning calibration dataset.
 */
export const getLearningFeedbackDataset = async (query = {}, requestingUser) => {
  const filter = await buildCalibrationFilter(query, requestingUser);

  if (query.approvedForLearning !== undefined && query.approvedForLearning !== "") {
    filter.approvedForLearning = String(query.approvedForLearning) === "true";
  }

  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await EvaluationFeedback.countDocuments(filter);
  const items = await EvaluationFeedback.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate("examId", "title")
    .populate("subjectId", "name code")
    .populate("createdBy", "name email role")
    .populate("studentId", "name rollNo")
    .lean();

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 7. PUT /api/v1/calibration/feedback/:id/approval
 * Updates approval status for controlled learning dataset (`approvedForLearning`).
 */
export const updateLearningApproval = async (feedbackId, approvedForLearning, requestingUser) => {
  if (requestingUser.role !== "faculty" && requestingUser.role !== "admin") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Not authorized to modify learning feedback approval.");
  }

  const feedback = await EvaluationFeedback.findById(feedbackId);
  if (!feedback) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Feedback record not found.");
  }

  feedback.approvedForLearning = Boolean(approvedForLearning);
  await feedback.save();

  logger.info(`Learning feedback approval updated for record ${feedbackId} by user ${requestingUser._id}: approvedForLearning=${feedback.approvedForLearning}`);
  return feedback;
};

/**
 * 8. GET /api/v1/evaluation/:id/review-history
 * Retrieves immutable review history for an evaluation.
 */
export const getEvaluationReviewHistory = async (evaluationId, requestingUser) => {
  const evaluation = await Evaluation.findById(evaluationId)
    .populate("answerSheet", "exam student subject submissionStatus reviewStatus")
    .populate("auditHistory.changedBy", "name email role")
    .lean();

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation record not found.");
  }

  const feedbackRecords = await EvaluationFeedback.find({
    evaluationId,
    isDeleted: false,
  })
    .sort("-createdAt")
    .populate("createdBy", "name email role")
    .lean();

  return {
    evaluationId: evaluation._id,
    reviewStatus: evaluation.reviewStatus || evaluation.facultyEvaluation?.status || "pending",
    auditHistory: evaluation.auditHistory || [],
    feedbackRecords: feedbackRecords || [],
  };
};

export default {
  getCalibrationSummary,
  getQuestionLevelCalibration,
  getConfidenceVsCorrection,
  getReferenceEffectAnalysis,
  getCalibrationInsights,
  getLearningFeedbackDataset,
  updateLearningApproval,
  getEvaluationReviewHistory,
};
