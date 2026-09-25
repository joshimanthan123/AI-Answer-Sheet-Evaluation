import EvaluationFeedback from "../models/EvaluationFeedback.js";
import ImprovementSuggestion from "../models/ImprovementSuggestion.js";
import Exam from "../models/Exam.js";
import Evaluation from "../models/Evaluation.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";

/**
 * Calculates AI Evaluation Improvement Dashboard Analytics.
 */
export const getImprovementAnalytics = async (examIdFilter, requestingUser) => {
  const filter = { isDeleted: false };

  if (requestingUser.role === "faculty") {
    const facultyExams = await Exam.find({ createdBy: requestingUser._id, isDeleted: false }).select("_id");
    const examIds = facultyExams.map((e) => e._id);
    filter.examId = { $in: examIds };
  }

  if (examIdFilter) {
    filter.examId = examIdFilter;
  }

  // Aggregate feedback metrics
  const allFeedback = await EvaluationFeedback.find(filter).lean();
  const totalFeedback = allFeedback.length;

  let totalOverrides = 0;
  let marksIncreased = 0;
  let marksDecreased = 0;
  let unchanged = 0;

  const categoryCounts = {
    alternative_answer: 0,
    mark_correction: 0,
    rubric_issue: 0,
    OCR_issue: 0,
    reference_answer_issue: 0,
    evaluation_logic_issue: 0,
    other: 0,
  };

  allFeedback.forEach((f) => {
    totalOverrides++;
    if (f.difference > 0) marksIncreased++;
    else if (f.difference < 0) marksDecreased++;
    else unchanged++;

    if (categoryCounts[f.feedbackType] !== undefined) {
      categoryCounts[f.feedbackType]++;
    } else {
      categoryCounts.other++;
    }
  });

  // Count improvement suggestions by status
  const suggestionFilter = { isDeleted: false };
  if (filter.examId) suggestionFilter.examId = filter.examId;

  const totalSuggestions = await ImprovementSuggestion.countDocuments(suggestionFilter);
  const pendingSuggestions = await ImprovementSuggestion.countDocuments({ ...suggestionFilter, status: "Pending" });
  const approvedSuggestions = await ImprovementSuggestion.countDocuments({ ...suggestionFilter, status: "Approved" });
  const implementedSuggestions = await ImprovementSuggestion.countDocuments({ ...suggestionFilter, status: "Implemented" });

  // Group feedback by Question to detect repeated patterns
  const questionPatternMap = new Map();
  allFeedback.forEach((f) => {
    const qKey = `${f.examId}_Q${f.questionNumber}`;
    if (!questionPatternMap.has(qKey)) {
      questionPatternMap.set(qKey, {
        examId: f.examId,
        questionNumber: f.questionNumber,
        count: 0,
        reasons: {},
        ocrCount: 0,
        totalAiConfidence: 0,
        lowConfidenceCount: 0,
        sampleComments: [],
      });
    }
    const qData = questionPatternMap.get(qKey);
    qData.count++;
    qData.reasons[f.reason] = (qData.reasons[f.reason] || 0) + 1;
    if (f.feedbackType === "OCR_issue" || (f.reason && f.reason.toLowerCase().includes("ocr"))) {
      qData.ocrCount++;
    }
    if (f.aiConfidence) {
      qData.totalAiConfidence += f.aiConfidence;
      if (f.aiConfidence < 0.7) qData.lowConfidenceCount++;
    }
    if (f.comment && qData.sampleComments.length < 3) {
      qData.sampleComments.push(f.comment);
    }
  });

  // Format potential improvement patterns
  const potentialImprovements = [];
  for (const [qKey, qData] of questionPatternMap.entries()) {
    if (qData.count >= 2) {
      const topReason = Object.entries(qData.reasons).sort((a, b) => b[1] - a[1])[0];
      let reviewPriority = "Low";
      if (qData.count >= 5 || qData.lowConfidenceCount >= 3) {
        reviewPriority = "High";
      } else if (qData.count >= 3) {
        reviewPriority = "Medium";
      }

      potentialImprovements.push({
        examId: qData.examId,
        questionNumber: qData.questionNumber,
        totalCorrections: qData.count,
        topReason: topReason ? topReason[0] : "Multiple corrections",
        topReasonCount: topReason ? topReason[1] : 0,
        ocrCorrections: qData.ocrCount,
        reviewPriority,
        sampleComments: qData.sampleComments,
        suggestionNeeded: qData.count >= 3,
        recommendation: `Question Q${qData.questionNumber} has ${qData.count} repeated faculty corrections. Review reference answer and rubric.`,
      });
    }
  }

  // Populate exam titles for potential improvements
  const examIdsToFetch = Array.from(new Set(potentialImprovements.map((p) => p.examId)));
  const exams = await Exam.find({ _id: { $in: examIdsToFetch } }).select("title").lean();
  const examTitleMap = new Map(exams.map((e) => [e._id.toString(), e.title]));

  potentialImprovements.forEach((p) => {
    p.examTitle = examTitleMap.get(p.examId.toString()) || "Exam";
  });

  return {
    overviewCards: {
      totalFeedback,
      totalOverrides,
      overrideRate: totalFeedback > 0 ? Number(((totalOverrides / totalFeedback) * 100).toFixed(1)) : 0,
      marksIncreased,
      marksDecreased,
      unchanged,
      totalSuggestions,
      pendingSuggestions,
      approvedSuggestions,
      implementedSuggestions,
    },
    categoryCounts: [
      { name: "Alternative Answer", count: categoryCounts.alternative_answer, type: "alternative_answer" },
      { name: "AI Underestimated / Mark Correction", count: categoryCounts.mark_correction, type: "mark_correction" },
      { name: "Rubric Issue", count: categoryCounts.rubric_issue, type: "rubric_issue" },
      { name: "OCR Issue", count: categoryCounts.OCR_issue, type: "OCR_issue" },
      { name: "Reference Answer Issue", count: categoryCounts.reference_answer_issue, type: "reference_answer_issue" },
      { name: "Evaluation Logic Issue", count: categoryCounts.evaluation_logic_issue, type: "evaluation_logic_issue" },
      { name: "Other", count: categoryCounts.other, type: "other" },
    ],
    potentialImprovements,
  };
};

/**
 * Creates an Improvement Suggestion from faculty feedback evidence.
 */
export const createImprovementSuggestion = async (data, requestingUser) => {
  const {
    examId,
    questionNumber,
    type,
    suggestedModelAnswer,
    suggestedRubric,
    justification,
    sourceFeedbackIds = [],
  } = data;

  if (!examId || !questionNumber || !type || !justification) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Missing required fields for improvement suggestion.");
  }

  const exam = await Exam.findById(examId);
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found.");
  }

  const numQNum = parseInt(String(questionNumber).replace(/[^\d]/g, ""));
  const examQ = exam.questions.find((q) => q.questionNumber === numQNum || String(q.questionNumber) === String(questionNumber));
  if (!examQ) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question Q${questionNumber} not found in exam.`);
  }

  const currentVersion = examQ.evaluationConfig?.version || 1;
  const currentModelAnswer = examQ.evaluationConfig?.modelAnswer || examQ.modelAnswer || "";
  const currentRubric = examQ.evaluationConfig?.rubric || examQ.rubricItems || [];

  const suggestion = await ImprovementSuggestion.create({
    examId,
    questionId: examQ._id,
    questionNumber: String(questionNumber),
    questionText: examQ.questionText,
    type,
    sourceFeedbackIds,
    currentVersion,
    currentModelAnswer,
    currentRubric,
    suggestedModelAnswer: suggestedModelAnswer || currentModelAnswer,
    suggestedRubric: suggestedRubric || currentRubric,
    justification,
    status: "Pending",
    createdBy: requestingUser._id,
    auditLog: [
      {
        action: "SUGGESTION_CREATED",
        performedBy: requestingUser._id,
        performedAt: new Date(),
        comment: justification,
      },
    ],
  });

  logger.info(`Created improvement suggestion ${suggestion._id} for exam ${examId}, Q${questionNumber}`);
  return suggestion;
};

/**
 * Retrieves paginated improvement suggestions.
 */
export const getImprovementSuggestions = async (query = {}, requestingUser) => {
  const { examId, status, type, page = 1, limit = 10 } = query;
  const filter = { isDeleted: false };

  if (requestingUser.role === "faculty") {
    const facultyExams = await Exam.find({ createdBy: requestingUser._id, isDeleted: false }).select("_id");
    const examIds = facultyExams.map((e) => e._id);
    filter.examId = { $in: examIds };
  }

  if (examId) filter.examId = examId;
  if (status) filter.status = status;
  if (type) filter.type = type;

  const limitNum = parseInt(limit) || 10;
  const pageNum = parseInt(page) || 1;
  const skip = (pageNum - 1) * limitNum;

  const total = await ImprovementSuggestion.countDocuments(filter);
  const items = await ImprovementSuggestion.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limitNum)
    .populate("examId", "title totalMarks")
    .populate("createdBy", "name email role")
    .populate("reviewedBy", "name email role")
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
 * Retrieves evidence and compare package for an improvement suggestion.
 */
export const getSuggestionEvidenceAndCompare = async (suggestionId) => {
  const suggestion = await ImprovementSuggestion.findById(suggestionId)
    .populate("examId", "title totalMarks questions")
    .populate("createdBy", "name email role")
    .populate("reviewedBy", "name email role")
    .lean();

  if (!suggestion) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Improvement suggestion not found.");
  }

  // Fetch feedback evidence
  let evidence = [];
  if (suggestion.sourceFeedbackIds && suggestion.sourceFeedbackIds.length > 0) {
    evidence = await EvaluationFeedback.find({ _id: { $in: suggestion.sourceFeedbackIds }, isDeleted: false })
      .populate("createdBy", "name")
      .lean();
  } else {
    evidence = await EvaluationFeedback.find({
      examId: suggestion.examId._id,
      questionNumber: String(suggestion.questionNumber),
      isDeleted: false,
    })
      .limit(20)
      .populate("createdBy", "name")
      .lean();
  }

  // Format evidence with anonymized evaluation IDs
  const anonymizedEvidence = evidence.map((e) => ({
    feedbackId: e._id,
    anonymizedEvaluationId: `Eval-${String(e.evaluationId).substring(18)}`,
    aiMarks: e.aiMarks,
    finalMarks: e.finalMarks,
    difference: e.difference >= 0 ? `+${e.difference}` : `${e.difference}`,
    reason: e.reason,
    comment: e.comment || "No comment provided",
    feedbackType: e.feedbackType,
    aiConfidence: e.aiConfidence ? `${(e.aiConfidence * 100).toFixed(0)}%` : "N/A",
    createdAt: e.createdAt,
  }));

  return {
    suggestion,
    comparison: {
      questionNumber: suggestion.questionNumber,
      questionText: suggestion.questionText,
      currentVersion: suggestion.currentVersion,
      currentModelAnswer: suggestion.currentModelAnswer,
      currentRubric: suggestion.currentRubric,
      suggestedModelAnswer: suggestion.suggestedModelAnswer,
      suggestedRubric: suggestion.suggestedRubric,
      justification: suggestion.justification,
    },
    evidence: anonymizedEvidence,
    evidenceCount: anonymizedEvidence.length,
  };
};

/**
 * Approves or Rejects an Improvement Suggestion.
 * When Approved: Updates reference answer / rubric in Exam, increments version number, sets status Active.
 * Old finalized results remain locked and unaffected. Future evaluations use new version.
 */
export const reviewImprovementSuggestion = async (suggestionId, action, reviewComment, requestingUser) => {
  if (requestingUser.role !== "admin" && requestingUser.role !== "faculty") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Only faculty and admin are authorized to review suggestions.");
  }

  const suggestion = await ImprovementSuggestion.findById(suggestionId);
  if (!suggestion) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Improvement suggestion not found.");
  }

  if (suggestion.status !== "Pending") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, `Suggestion has already been ${suggestion.status.toLowerCase()}.`);
  }

  const exam = await Exam.findById(suggestion.examId);
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found.");
  }

  const numQNum = parseInt(String(suggestion.questionNumber).replace(/[^\d]/g, ""));
  const examQ = exam.questions.find((q) => q.questionNumber === numQNum || String(q.questionNumber) === String(suggestion.questionNumber));

  if (!examQ) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, `Question Q${suggestion.questionNumber} not found in exam layout.`);
  }

  if (action === "approve" || action === "Approved") {
    const previousVersion = examQ.evaluationConfig?.version || 1;
    const newVersion = previousVersion + 1;

    // Update Exam question evaluationConfig
    examQ.evaluationConfig = examQ.evaluationConfig || {};
    examQ.evaluationConfig.version = newVersion;
    if (suggestion.suggestedModelAnswer) {
      examQ.evaluationConfig.modelAnswer = suggestion.suggestedModelAnswer;
      examQ.modelAnswer = suggestion.suggestedModelAnswer;
    }
    if (suggestion.suggestedRubric && suggestion.suggestedRubric.length > 0) {
      examQ.evaluationConfig.rubric = suggestion.suggestedRubric.map((r) => ({
        criterion: r.criterion,
        description: r.description || "",
        maxMarks: Number(r.maxMarks) || 1,
      }));
      examQ.rubricItems = suggestion.suggestedRubric.map((r) => ({
        criterion: r.criterion,
        description: r.description || "",
        maxMarks: Number(r.maxMarks) || 1,
      }));
    }

    // Maintain version history audit on question
    if (!examQ.versionHistory) examQ.versionHistory = [];
    examQ.versionHistory.forEach((vh) => (vh.status = "Archived"));

    examQ.versionHistory.push({
      version: newVersion,
      modelAnswer: examQ.modelAnswer,
      rubric: examQ.evaluationConfig.rubric,
      createdBy: requestingUser._id,
      createdAt: new Date(),
      changeReason: reviewComment || suggestion.justification || "Faculty/Admin approved suggestion",
      previousVersion,
      status: "Active",
    });

    await exam.save();

    // Update Suggestion status
    suggestion.status = "Approved";
    suggestion.reviewedBy = requestingUser._id;
    suggestion.reviewedAt = new Date();
    suggestion.reviewComment = reviewComment || "Approved by faculty/admin";
    suggestion.createdVersion = newVersion;

    suggestion.auditLog.push({
      action: "SUGGESTION_APPROVED",
      performedBy: requestingUser._id,
      performedAt: new Date(),
      comment: reviewComment || "Approved",
      previousVersion,
      newVersion,
    });

    await suggestion.save();
    logger.info(`Approved suggestion ${suggestionId}. Question Q${suggestion.questionNumber} version updated v${previousVersion} -> v${newVersion}`);

    return {
      suggestion,
      activatedVersion: newVersion,
      message: `Suggestion approved. Question Q${suggestion.questionNumber} upgraded to Version ${newVersion}. Historical evaluations remain unchanged.`,
    };
  } else if (action === "reject" || action === "Rejected") {
    suggestion.status = "Rejected";
    suggestion.reviewedBy = requestingUser._id;
    suggestion.reviewedAt = new Date();
    suggestion.reviewComment = reviewComment || "Rejected by faculty/admin";

    suggestion.auditLog.push({
      action: "SUGGESTION_REJECTED",
      performedBy: requestingUser._id,
      performedAt: new Date(),
      comment: reviewComment || "Rejected",
    });

    await suggestion.save();
    logger.info(`Rejected suggestion ${suggestionId}. Original reference answer/rubric version preserved.`);

    return {
      suggestion,
      message: `Suggestion rejected. Original reference answer and rubric version remain active.`,
    };
  } else {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid action. Action must be 'approve' or 'reject'.");
  }
};

export default {
  getImprovementAnalytics,
  createImprovementSuggestion,
  getImprovementSuggestions,
  getSuggestionEvidenceAndCompare,
  reviewImprovementSuggestion,
};
