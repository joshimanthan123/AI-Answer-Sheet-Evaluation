import mongoose from "mongoose";
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

export const reviewFacultyEvaluation = async (targetId, reviewData, userId) => {
  const { action, finalMarks, comment, questionId: reqQId, questionNumber: reqQNum } = reviewData || {};

  if (!action || !["approve", "modify", "re_evaluate"].includes(action)) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid action. Supported actions: approve, modify, re_evaluate.");
  }

  // 1. Resolve Evaluation & AnswerSheet documents
  let evaluation = await Evaluation.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      { answerSheet: mongoose.isValidObjectId(targetId) ? targetId : null },
      { "questions._id": mongoose.isValidObjectId(targetId) ? targetId : null },
      { "questions.questionId": mongoose.isValidObjectId(targetId) ? targetId : null },
    ],
    isDeleted: false,
  }).populate({
    path: "answerSheet",
    populate: { path: "exam" },
  });

  let ansSheet = null;
  if (evaluation) {
    ansSheet = evaluation.answerSheet;
  } else {
    ansSheet = await AnswerSheet.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
        { "answers._id": mongoose.isValidObjectId(targetId) ? targetId : null },
        { "answers.questionId": mongoose.isValidObjectId(targetId) ? targetId : null },
        { "digital_answers._id": mongoose.isValidObjectId(targetId) ? targetId : null },
        { "digital_answers.question_id": mongoose.isValidObjectId(targetId) ? targetId : null },
      ],
      isDeleted: false,
    }).populate("exam");

    if (ansSheet) {
      evaluation = await Evaluation.findOne({ answerSheet: ansSheet._id, isDeleted: false });
    }
  }

  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet/question not found.");
  }

  const exam = ansSheet.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found.");
  }

  // 2. Identify target question in Evaluation
  let targetQId = reqQId || targetId;
  let qEval = null;

  if (evaluation && evaluation.questions && evaluation.questions.length > 0) {
    qEval = evaluation.questions.find(
      (q) =>
        (q._id && q._id.toString() === targetQId.toString()) ||
        (q.questionId && q.questionId.toString() === targetQId.toString()) ||
        (reqQNum && q.questionNumber && String(q.questionNumber) === String(reqQNum))
    );

    if (!qEval && evaluation.questions.length === 1) {
      qEval = evaluation.questions[0];
    }
  }

  let examQuestion = null;
  if (qEval) {
    examQuestion = exam.questions?.find((eq) => eq._id.toString() === qEval.questionId.toString());
  } else if (reqQNum || reqQId) {
    examQuestion = exam.questions?.find(
      (eq) =>
        eq._id.toString() === String(reqQId) ||
        String(eq.questionNumber) === String(reqQNum) ||
        eq._id.toString() === String(targetId)
    );
  } else if (exam.questions && exam.questions.length === 1) {
    examQuestion = exam.questions[0];
  }

  const maxMarks = examQuestion ? examQuestion.maximumMarks : (qEval?.maximumMarks || 10);

  // 3. Process Action Logic
  if (action === "approve") {
    const aiScore = qEval?.aiEvaluation?.marksAwarded ?? qEval?.aiMarks ?? 0;
    
    if (
      qEval &&
      (qEval.status === "failed" ||
        (qEval.reason && qEval.reason.includes("OCR")) ||
        (qEval.errorMessage && qEval.errorMessage.includes("OCR")) ||
        (qEval.feedback && qEval.feedback.includes("OCR")))
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "OCR text unavailable; manual review/modification required.");
    }

    let approvedMarks = aiScore;
    if (finalMarks !== undefined && finalMarks !== null) {
      const parsed = Number(finalMarks);
      if (isNaN(parsed) || parsed < 0 || parsed > maxMarks) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, `Final marks must be between 0 and ${maxMarks}.`);
      }
      approvedMarks = parsed;
    }

    const appComment = (comment && typeof comment === "string" && comment.trim().length > 0) 
      ? comment.trim() 
      : "AI evaluation accepted.";

    if (qEval) {
      qEval.facultyEvaluation = {
        status: "approved",
        finalMarks: approvedMarks,
        comment: appComment,
        reviewedBy: userId,
        reviewedAt: new Date(),
      };
      qEval.facultyMarks = approvedMarks;
      qEval.facultyAwardedMarks = approvedMarks;
      qEval.finalAwardedMarks = approvedMarks;
      qEval.facultyComment = appComment;
    }

    if (evaluation) {
      evaluation.auditHistory.push({
        action: "REVIEW_APPROVED",
        questionNumber: examQuestion ? `Q${examQuestion.questionNumber}` : (qEval ? `Q${qEval.questionNumber}` : "Sheet"),
        previousValue: { aiMarks: aiScore },
        newValue: { finalMarks: approvedMarks, status: "approved" },
        comment: appComment,
        changedBy: userId,
        changedAt: new Date(),
      });
    }

  } else if (action === "modify") {
    if (
      finalMarks === undefined ||
      finalMarks === null ||
      typeof finalMarks === "boolean" ||
      typeof finalMarks === "object"
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, `Final marks must be between 0 and ${maxMarks}.`);
    }

    const parsedMarks = Number(finalMarks);
    if (isNaN(parsedMarks) || !isFinite(parsedMarks) || parsedMarks < 0 || parsedMarks > maxMarks) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, `Final marks must be between 0 and ${maxMarks}.`);
    }

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "Faculty comment is required when modifying marks.");
    }

    const modComment = comment.trim();

    if (qEval) {
      qEval.facultyEvaluation = {
        status: "modified",
        finalMarks: parsedMarks,
        comment: modComment,
        reviewedBy: userId,
        reviewedAt: new Date(),
      };
      qEval.facultyMarks = parsedMarks;
      qEval.facultyAwardedMarks = parsedMarks;
      qEval.finalAwardedMarks = parsedMarks;
      qEval.wasOverridden = true;
      qEval.facultyComment = modComment;
    }

    if (evaluation) {
      evaluation.auditHistory.push({
        action: "MARK_OVERRIDDEN",
        questionNumber: examQuestion ? `Q${examQuestion.questionNumber}` : (qEval ? `Q${qEval.questionNumber}` : "Sheet"),
        previousValue: { aiMarks: qEval?.aiMarks ?? 0 },
        newValue: { finalMarks: parsedMarks, status: "modified" },
        comment: modComment,
        changedBy: userId,
        changedAt: new Date(),
      });
    }

  } else if (action === "re_evaluate") {
    if (qEval) {
      qEval.facultyEvaluation = {
        status: "re_evaluation_requested",
        finalMarks: null,
        comment: comment ? String(comment).trim() : "Re-evaluation requested by faculty",
        reviewedBy: userId,
        reviewedAt: new Date(),
      };
    }

    if (evaluation) {
      evaluation.auditHistory.push({
        action: "RE_EVALUATION_REQUESTED",
        questionNumber: examQuestion ? `Q${examQuestion.questionNumber}` : (qEval ? `Q${qEval.questionNumber}` : "Sheet"),
        comment: comment ? String(comment).trim() : "Re-evaluation requested by faculty",
        changedBy: userId,
        changedAt: new Date(),
      });
      await evaluation.save();
    }

    const reEvalRes = await evaluationPipelineService.queueEvaluation(ansSheet._id, userId, {
      scope: qEval ? "QUESTION" : "FULL_SHEET",
      questionNumber: qEval?.questionNumber || examQuestion?.questionNumber,
      reEvaluate: true,
    });

    return reEvalRes;
  }

  if (evaluation && evaluation.questions && evaluation.questions.length > 0) {
    const summary = evaluationValidator.calculateEvaluationSummary(evaluation.questions);
    evaluation.obtainedMarks = summary.totalAwardedMarks;
    evaluation.totalMarks = summary.totalMaximumMarks;
    evaluation.percentage = summary.percentage;
    evaluation.grade = gradingService.calculateGrade(summary.percentage);
    evaluation.reviewedBy = userId;
    evaluation.reviewedAt = new Date();
    evaluation.updatedBy = userId;
    evaluation.markModified("questions");
    await evaluation.save();

    ansSheet.evaluationSummary = summary;
    ansSheet.reviewStatus = "FACULTY_REVIEW_IN_PROGRESS";
    ansSheet.reviewedBy = userId;
    ansSheet.reviewedAt = new Date();
    
    for (const q of evaluation.questions) {
      if (Array.isArray(ansSheet.answers)) {
        const aItem = ansSheet.answers.find(
          (a) => (a.questionId && a.questionId.toString() === q.questionId.toString()) || (a.questionNumber && a.questionNumber === q.questionNumber)
        );
        if (aItem) {
          aItem.finalAwardedMarks = q.facultyEvaluation?.finalMarks ?? q.finalAwardedMarks;
          aItem.facultyEvaluation = q.facultyEvaluation;
        }
      }

      if (Array.isArray(ansSheet.digital_answers)) {
        const daItem = ansSheet.digital_answers.find(
          (da) => (da.question_id && da.question_id.toString() === q.questionId.toString()) || (da.question_number && String(da.question_number) === String(q.questionNumber))
        );
        if (daItem && daItem.evaluation) {
          daItem.evaluation.facultyEvaluation = q.facultyEvaluation;
        }
      }
    }

    ansSheet.markModified("digital_answers");
    ansSheet.markModified("answers");
    await ansSheet.save();
  }

  return evaluation || ansSheet;
};

export const calculateSheetEvaluationSummary = async (answerSheetId) => {
  const evaluation = await Evaluation.findOne({
    answerSheet: answerSheetId,
    isDeleted: false,
  }).populate({
    path: "answerSheet",
    populate: { path: "exam" },
  });

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation document not found for this answer sheet.");
  }

  const ansSheet = evaluation.answerSheet;
  const exam = ansSheet?.exam;

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found.");
  }

  const questions = evaluation.questions || [];
  const examQuestions = exam.questions || [];
  const totalQuestionsCount = examQuestions.length > 0 ? examQuestions.length : questions.length;

  let totalMarksObtained = 0;
  let maximumMarks = 0;
  let evaluatedQuestions = 0;
  let pendingQuestions = 0;
  let unansweredQuestions = 0;
  let aiEvaluatedQuestions = 0;
  let facultyModifiedQuestions = 0;

  if (examQuestions.length > 0) {
    for (const eq of examQuestions) {
      const qMax = eq.maximumMarks || 0;
      maximumMarks += qMax;

      const qEval = questions.find(
        (q) =>
          (q.questionId && q.questionId.toString() === eq._id.toString()) ||
          (q.questionNumber && String(q.questionNumber) === String(eq.questionNumber))
      );

      if (!qEval) {
        pendingQuestions++;
        continue;
      }

      if (qEval.aiEvaluation && (qEval.aiEvaluation.status === "completed" || qEval.aiEvaluation.marksAwarded !== undefined)) {
        aiEvaluatedQuestions++;
      }

      const facStatus = qEval.facultyEvaluation?.status;
      const facMarks = qEval.facultyEvaluation?.finalMarks;

      if (facStatus === "modified" || qEval.wasOverridden) {
        facultyModifiedQuestions++;
      }

      if (qEval.status === "unanswered" || qEval.isUnanswered) {
        unansweredQuestions++;
        evaluatedQuestions++;
      } else if ((facStatus === "approved" || facStatus === "modified") && typeof facMarks === "number" && !isNaN(facMarks)) {
        evaluatedQuestions++;
        totalMarksObtained += facMarks;
      } else {
        pendingQuestions++;
      }
    }
  } else {
    for (const qEval of questions) {
      const qMax = qEval.maximumMarks || 0;
      maximumMarks += qMax;

      if (qEval.aiEvaluation && qEval.aiEvaluation.marksAwarded !== undefined) {
        aiEvaluatedQuestions++;
      }

      const facStatus = qEval.facultyEvaluation?.status;
      const facMarks = qEval.facultyEvaluation?.finalMarks;

      if (facStatus === "modified" || qEval.wasOverridden) {
        facultyModifiedQuestions++;
      }

      if (qEval.status === "unanswered" || qEval.isUnanswered) {
        unansweredQuestions++;
        evaluatedQuestions++;
      } else if ((facStatus === "approved" || facStatus === "modified") && typeof facMarks === "number" && !isNaN(facMarks)) {
        evaluatedQuestions++;
        totalMarksObtained += facMarks;
      } else {
        pendingQuestions++;
      }
    }
  }

  const rawPercentage = maximumMarks > 0 ? (totalMarksObtained / maximumMarks) * 100 : 0;
  const percentage = Math.round(rawPercentage * 100) / 100;

  let status = "in_progress";
  if (evaluation.evaluationStatus === "finalized" || evaluation.finalEvaluation?.status === "finalized") {
    status = "finalized";
  } else if (pendingQuestions === 0 && totalQuestionsCount > 0) {
    status = "ready_for_finalization";
  } else if (evaluatedQuestions > 0) {
    status = "in_progress";
  } else {
    status = "not_started";
  }

  const summary = {
    totalMarksObtained,
    maximumMarks,
    percentage,
    totalQuestions: totalQuestionsCount,
    evaluatedQuestions,
    pendingQuestions,
    unansweredQuestions,
    aiEvaluatedQuestions,
    facultyModifiedQuestions,
    status,
  };

  return { evaluation, ansSheet, exam, summary };
};

export const getReviewDashboardData = async (examId, userId, query = {}) => {
  const Exam = (await import("../models/Exam.js")).default;
  const exam = await Exam.findOne({ _id: examId, isDeleted: false }).populate("subject");
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Find all answer sheets for this exam
  const answerSheets = await AnswerSheet.find({ exam: examId, isDeleted: false })
    .populate("student", "name email rollNo studentId")
    .populate("subject", "name code")
    .lean();

  const sheetIds = answerSheets.map((s) => s._id);

  // Find evaluations for these answer sheets
  const evaluations = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: false,
  }).lean();

  const evalMap = new Map();
  evaluations.forEach((ev) => {
    evalMap.set(ev.answerSheet.toString(), ev);
  });

  let totalStudents = answerSheets.length;
  let evaluatedCount = 0;
  let pendingReviewCount = 0;
  let needsAttentionCount = 0;
  let reviewedCount = 0;

  const studentsList = answerSheets.map((sheet) => {
    const ev = evalMap.get(sheet._id.toString());
    const studentUser = sheet.student || {};
    const studentName = studentUser.name || sheet.studentIdentifier || "Unknown Student";
    const rollNo = studentUser.rollNo || studentUser.studentId || sheet.studentIdentifier || `STU-${sheet._id.toString().slice(-4).toUpperCase()}`;
    const studentId = studentUser._id ? studentUser._id.toString() : sheet.studentIdentifier || sheet._id.toString();

    let totalAiMarks = 0;
    let maxMarks = exam.totalMarks || 0;
    let percentage = 0;
    let overallConfidence = 90;
    let reviewStatus = "Pending Review";
    let isEvaluated = false;
    let isUnanswered = false;

    if (ev) {
      isEvaluated = true;
      totalAiMarks = ev.obtainedMarks !== undefined ? ev.obtainedMarks : 0;
      maxMarks = ev.totalMarks || exam.totalMarks || 10;
      percentage = ev.percentage !== undefined ? ev.percentage : (maxMarks > 0 ? (totalAiMarks / maxMarks) * 100 : 0);

      // Compute average confidence
      if (Array.isArray(ev.questions) && ev.questions.length > 0) {
        let confSum = 0;
        let confCount = 0;
        ev.questions.forEach((q) => {
          const c = q.aiEvaluation?.confidence ?? q.confidence ?? 0.9;
          confSum += (c > 1 ? c / 100 : c);
          confCount++;
          if (q.status === "unanswered" || q.isUnanswered) {
            isUnanswered = true;
          }
        });
        if (confCount > 0) {
          overallConfidence = Math.round((confSum / confCount) * 100);
        }
      }

      // Map status
      const rawRevStatus = ev.reviewStatus || sheet.reviewStatus || "";
      const facEvalStatus = ev.questions?.[0]?.facultyEvaluation?.status;

      if (rawRevStatus === "APPROVED" || rawRevStatus === "FINALIZED" || ev.evaluationStatus === "reviewed" || ev.evaluationStatus === "finalized" || facEvalStatus === "approved") {
        reviewStatus = "Reviewed";
        reviewedCount++;
      } else if (rawRevStatus === "REVISION_REQUIRED" || rawRevStatus === "NEEDS_ATTENTION" || rawRevStatus === "Needs Attention" || overallConfidence < 75 || ev.evaluationStatus === "PARTIALLY_EVALUATED" || ev.evaluationStatus === "EVALUATION_FAILED") {
        reviewStatus = "Needs Attention";
        needsAttentionCount++;
      } else {
        reviewStatus = "Pending Review";
        pendingReviewCount++;
      }
      evaluatedCount++;
    } else {
      reviewStatus = "Pending Review";
      pendingReviewCount++;
    }

    return {
      evaluationId: ev ? ev._id : null,
      answerSheetId: sheet._id,
      studentId,
      studentName,
      enrollmentNumber: rollNo,
      rollNo,
      examId: exam._id,
      examTitle: exam.title,
      submittedAt: sheet.submittedAt || sheet.createdAt,
      totalAiMarks,
      maxMarks,
      percentage,
      overallConfidence,
      reviewStatus,
      isEvaluated,
      isUnanswered,
    };
  });

  const stats = {
    totalStudents,
    evaluated: evaluatedCount,
    pendingReview: pendingReviewCount,
    needsAttention: needsAttentionCount,
    reviewed: reviewedCount,
  };

  return { stats, studentsList, exam };
};

export const getEvaluationDetail = async (targetId, userId, userRole) => {
  let evaluation = await Evaluation.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      { answerSheet: mongoose.isValidObjectId(targetId) ? targetId : null },
    ],
    isDeleted: false,
  })
    .populate({
      path: "answerSheet",
      populate: [
        { path: "student", select: "name email rollNo studentId" },
        { path: "subject", select: "name code" },
        { path: "exam" },
      ],
    })
    .lean();

  let answerSheet = null;
  if (evaluation) {
    answerSheet = evaluation.answerSheet;
  } else {
    answerSheet = await AnswerSheet.findOne({ _id: targetId, isDeleted: false })
      .populate("student", "name email rollNo studentId")
      .populate("subject", "name code")
      .populate("exam")
      .lean();
  }

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation or Answer Sheet not found");
  }

  // Student role check
  if (userRole === "student") {
    const studentOwnerId = answerSheet.student?._id ? answerSheet.student._id.toString() : answerSheet.student?.toString();
    if (studentOwnerId !== userId.toString()) {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this answer sheet.");
    }
  }

  const exam = answerSheet.exam || {};
  const examQuestions = exam.questions || [];

  // Match and prepare question details
  const questionsList = [];
  const evalQuestions = evaluation ? (evaluation.questions || []) : [];

  for (let i = 0; i < examQuestions.length; i++) {
    const eq = examQuestions[i];
    const qNum = eq.questionNumber || (i + 1);

    const qEval = evalQuestions.find(
      (q) =>
        (q.questionId && q.questionId.toString() === eq._id.toString()) ||
        (q.questionNumber && String(q.questionNumber) === String(qNum))
    ) || {};

    const digitalAns = (answerSheet.digital_answers || []).find(
      (da) =>
        (da.question_id && da.question_id.toString() === eq._id.toString()) ||
        (da.question_number && String(da.question_number) === String(qNum))
    ) || {};

    const ansItem = (answerSheet.answers || []).find(
      (a) =>
        (a.questionId && a.questionId.toString() === eq._id.toString()) ||
        (a.questionNumber && String(a.questionNumber) === String(qNum))
    ) || {};

    // Determine real OCR text
    const ocrText = (
      qEval.recognizedText ||
      qEval.studentAnswer ||
      digitalAns.recognizedText ||
      digitalAns.text ||
      digitalAns.answer_text ||
      ansItem.recognizedText ||
      ""
    ).trim();

    // Model / Reference Answer
    const modelAnswer = (
      qEval.modelAnswer ||
      eq.evaluationConfig?.modelAnswer ||
      eq.modelAnswer ||
      ""
    ).trim();

    // AI Marks and Confidence
    const maxMarks = eq.maximumMarks || qEval.maximumMarks || 10;
    const aiMarks = qEval.aiEvaluation?.marksAwarded ?? qEval.aiMarks ?? qEval.aiAwardedMarks ?? 0;
    const rawConf = qEval.aiEvaluation?.confidence ?? qEval.confidence ?? digitalAns.confidence ?? 0.9;
    const confidence = Math.round((rawConf > 1 ? rawConf / 100 : rawConf) * 100);

    // AI Explanation
    const feedback = qEval.aiEvaluation?.feedback || qEval.feedback || qEval.reason || "AI evaluation completed.";

    // Concepts
    const matchedConcepts = qEval.aiEvaluation?.matchedConcepts || qEval.matchedConcepts || qEval.matchedKeywords || [];
    const missingConcepts = qEval.aiEvaluation?.missingConcepts || qEval.missingConcepts || qEval.missingKeywords || [];

    // Concept Comparison
    const conceptComparison = [];
    const allConceptsSet = new Set([...matchedConcepts, ...missingConcepts]);
    allConceptsSet.forEach((concept) => {
      conceptComparison.push({
        concept,
        referenceMatched: true,
        studentMatched: matchedConcepts.includes(concept),
      });
    });

    // Page & Stroke references for original handwriting
    const pageNumber = digitalAns.page_number || 1;
    const strokes = digitalAns.strokes || [];
    const pages = answerSheet.pages || [];

    questionsList.push({
      questionId: eq._id,
      questionNumber: qNum,
      questionText: eq.questionText || `Question ${qNum}`,
      maxMarks,
      originalHandwriting: {
        pageNumber,
        strokes,
        pages,
        uploadedFileUrl: answerSheet.uploadedFileUrl,
      },
      ocrDigitizedAnswer: ocrText,
      referenceAnswer: modelAnswer,
      aiEvaluation: {
        aiMarks,
        maxMarks,
        confidence,
        status: qEval.status || "completed",
        feedback,
        criteria: qEval.aiEvaluation?.criteria || qEval.criteria || [],
      },
      matchedConcepts,
      missingConcepts,
      conceptComparison,
      borderlineEvaluation: qEval.borderlineEvaluation || null,
      referenceAwareEvaluation: qEval.referenceAwareEvaluation || null,
      facultyEvaluation: qEval.facultyEvaluation || { status: "pending", finalMarks: null, comment: null },
    });
  }

  // Calculate total metrics
  let totalAiMarks = evaluation ? evaluation.obtainedMarks : 0;
  let totalMaxMarks = evaluation ? evaluation.totalMarks : (exam.totalMarks || 10);
  let overallConfidence = 90;
  if (questionsList.length > 0) {
    const sumConf = questionsList.reduce((acc, q) => acc + q.aiEvaluation.confidence, 0);
    overallConfidence = Math.round(sumConf / questionsList.length);
  }

  // Map overall review status
  let reviewStatus = "Pending Review";
  const rawRevStatus = evaluation?.reviewStatus || answerSheet.reviewStatus || "";
  if (rawRevStatus === "APPROVED" || rawRevStatus === "FINALIZED" || evaluation?.evaluationStatus === "reviewed" || evaluation?.evaluationStatus === "finalized") {
    reviewStatus = "Reviewed";
  } else if (rawRevStatus === "REVISION_REQUIRED" || rawRevStatus === "NEEDS_ATTENTION" || rawRevStatus === "Needs Attention" || overallConfidence < 75) {
    reviewStatus = "Needs Attention";
  }

  const studentUser = answerSheet.student || {};

  return {
    evaluationId: evaluation ? evaluation._id : null,
    answerSheetId: answerSheet._id,
    student: {
      studentId: studentUser._id ? studentUser._id.toString() : answerSheet.studentIdentifier,
      name: studentUser.name || answerSheet.studentIdentifier || "Unknown Student",
      rollNo: studentUser.rollNo || studentUser.studentId || answerSheet.studentIdentifier || `STU-${answerSheet._id.toString().slice(-4).toUpperCase()}`,
      email: studentUser.email || "",
    },
    exam: {
      examId: exam._id,
      title: exam.title,
      code: exam.code,
      subjectName: answerSheet.subject?.name || "",
    },
    submittedAt: answerSheet.submittedAt || answerSheet.createdAt,
    totalAiMarks,
    maxMarks: totalMaxMarks,
    percentage: evaluation ? evaluation.percentage : 0,
    overallConfidence,
    reviewStatus,
    questions: questionsList,
  };
};

export const updateEvaluationReviewStatus = async (evaluationId, reviewStatus, comment, userId) => {
  let evaluation = await Evaluation.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(evaluationId) ? evaluationId : null },
      { answerSheet: mongoose.isValidObjectId(evaluationId) ? evaluationId : null },
    ],
    isDeleted: false,
  });

  let ansSheet = null;
  if (evaluation) {
    ansSheet = await AnswerSheet.findById(evaluation.answerSheet);
  } else {
    ansSheet = await AnswerSheet.findOne({ _id: evaluationId, isDeleted: false });
    if (ansSheet) {
      evaluation = await Evaluation.findOne({ answerSheet: ansSheet._id, isDeleted: false });
    }
  }

  if (!ansSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer Sheet or Evaluation not found");
  }

  let mappedStatus = "READY_FOR_FACULTY_REVIEW";
  let displayStatus = "Pending Review";

  if (reviewStatus === "Reviewed" || reviewStatus === "APPROVED" || reviewStatus === "approved") {
    mappedStatus = "APPROVED";
    displayStatus = "Reviewed";
  } else if (reviewStatus === "Needs Attention" || reviewStatus === "NEEDS_ATTENTION" || reviewStatus === "needs_attention") {
    mappedStatus = "NEEDS_ATTENTION";
    displayStatus = "Needs Attention";
  } else if (reviewStatus === "Pending Review" || reviewStatus === "READY_FOR_FACULTY_REVIEW") {
    mappedStatus = "READY_FOR_FACULTY_REVIEW";
    displayStatus = "Pending Review";
  }

  ansSheet.reviewStatus = mappedStatus;
  ansSheet.reviewedBy = userId;
  ansSheet.reviewedAt = new Date();
  await ansSheet.save();

  if (evaluation) {
    evaluation.reviewStatus = mappedStatus;
    evaluation.reviewedBy = userId;
    evaluation.reviewedAt = new Date();
    if (mappedStatus === "APPROVED") {
      evaluation.evaluationStatus = "reviewed";
    } else if (mappedStatus === "NEEDS_ATTENTION") {
      evaluation.evaluationStatus = "PARTIALLY_EVALUATED";
    }
    evaluation.auditHistory.push({
      action: mappedStatus === "APPROVED" ? "REVIEW_APPROVED" : "REVISION_REQUESTED",
      comment: comment || `Review status updated to ${displayStatus} by faculty.`,
      changedBy: userId,
      changedAt: new Date(),
    });
    await evaluation.save();
  }

  return {
    evaluationId: evaluation ? evaluation._id : null,
    answerSheetId: ansSheet._id,
    reviewStatus: displayStatus,
    mappedStatus,
    updatedAt: new Date(),
  };
};

export const finalizeAnswerSheetEvaluation = async (targetId, userId) => {
  let evaluation = await Evaluation.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      { answerSheet: mongoose.isValidObjectId(targetId) ? targetId : null },
    ],
    isDeleted: false,
  });

  let answerSheetId = evaluation ? evaluation.answerSheet : targetId;

  const { evaluation: evalDoc, ansSheet, summary } = await calculateSheetEvaluationSummary(answerSheetId);

  if (summary.totalQuestions === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "No evaluable questions found for this answer sheet.");
  }

  if (summary.pendingQuestions > 0) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Cannot finalize answer sheet: ${summary.pendingQuestions} question(s) still require faculty review.`
    );
  }

  if (evalDoc.evaluationStatus === "finalized" || evalDoc.finalEvaluation?.status === "finalized") {
    return evalDoc;
  }

  evalDoc.obtainedMarks = summary.totalMarksObtained;
  evalDoc.totalMarks = summary.maximumMarks;
  evalDoc.percentage = summary.percentage;
  evalDoc.evaluationStatus = "finalized";
  evalDoc.finalizedBy = userId;
  evalDoc.finalizedAt = new Date();
  evalDoc.updatedBy = userId;

  evalDoc.finalEvaluation = {
    status: "finalized",
    totalMarksObtained: summary.totalMarksObtained,
    maximumMarks: summary.maximumMarks,
    percentage: summary.percentage,
    totalQuestions: summary.totalQuestions,
    evaluatedQuestions: summary.evaluatedQuestions,
    pendingQuestions: 0,
    unansweredQuestions: summary.unansweredQuestions,
    aiEvaluatedQuestions: summary.aiEvaluatedQuestions,
    facultyModifiedQuestions: summary.facultyModifiedQuestions,
    finalizedBy: userId,
    finalizedAt: new Date(),
  };

  evalDoc.auditHistory.push({
    action: "EVALUATION_FINALIZED",
    questionNumber: "Sheet",
    newValue: {
      totalMarksObtained: summary.totalMarksObtained,
      maximumMarks: summary.maximumMarks,
      percentage: summary.percentage,
      status: "finalized",
    },
    comment: `Evaluation finalized by faculty (${userId}). Total: ${summary.totalMarksObtained}/${summary.maximumMarks} (${summary.percentage}%)`,
    changedBy: userId,
    changedAt: new Date(),
  });

  await evalDoc.save();

  if (ansSheet) {
    ansSheet.evaluationStatus = "finalized";
    ansSheet.submissionStatus = "Published";
    await ansSheet.save();
  }

  return evalDoc;
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
  reviewFacultyEvaluation,
  finalizeEvaluation,
  calculateSheetEvaluationSummary,
  finalizeAnswerSheetEvaluation,
  getReviewDashboardData,
  getEvaluationDetail,
  updateEvaluationReviewStatus,
};

