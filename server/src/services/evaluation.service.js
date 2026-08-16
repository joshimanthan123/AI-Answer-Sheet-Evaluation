import Evaluation from "../models/Evaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";

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

  let evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    evaluation = await Evaluation.create({
      answerSheet: answerSheetId,
      evaluationType: "AI",
      obtainedMarks: 0,
      totalMarks: exam ? exam.totalMarks : 10,
      percentage: 0,
      evaluationStatus: "pending",
      createdBy: userId,
      updatedBy: userId,
    });
  } else {
    evaluation.evaluationStatus = "pending";
    evaluation.updatedBy = userId;
    await evaluation.save();
  }

  // Restart pipeline async
  evaluationPipelineService.runPipeline(evaluation._id, answerSheetId, userId).catch((err) => {
    logger.error(`Re-evaluation run failure for answerSheet ${answerSheetId}: ${err.message}`);
  });

  return evaluation;
};

export const reviewQuestion = async (evaluationId, questionId, data, userId) => {
  const evaluation = await Evaluation.findOne({ _id: evaluationId, isDeleted: false }).populate({
    path: "answerSheet",
    populate: { path: "exam" },
  });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  const exam = evaluation.answerSheet?.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam details not found");
  }

  if (exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam evaluation");
  }

  if (
    evaluation.evaluationStatus === "finalized" ||
    evaluation.evaluationStatus === "PUBLISHED" ||
    evaluation.evaluationStatus === "reviewed"
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot modify a finalized evaluation");
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

  // Also recalculate obtained marks dynamically
  let newObtainedTotal = 0;
  for (const q of evaluation.questions) {
    newObtainedTotal += q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : q.aiAwardedMarks;
  }
  evaluation.obtainedMarks = newObtainedTotal;
  evaluation.percentage = Number(((newObtainedTotal / evaluation.totalMarks) * 100).toFixed(2));

  let grade = "F";
  if (evaluation.percentage >= 90) grade = "A+";
  else if (evaluation.percentage >= 80) grade = "A";
  else if (evaluation.percentage >= 70) grade = "B";
  else if (evaluation.percentage >= 60) grade = "C";
  else if (evaluation.percentage >= 50) grade = "D";
  else if (evaluation.percentage >= 40) grade = "E";
  evaluation.grade = grade;

  evaluation.updatedBy = userId;
  await evaluation.save();

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

  const exam = evaluation.answerSheet?.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam details not found");
  }

  if (exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam evaluation");
  }

  let finalObtained = 0;
  for (const q of evaluation.questions) {
    // If not overridden, final score defaults to AI marks
    if (q.finalAwardedMarks === undefined) {
      q.finalAwardedMarks = q.aiAwardedMarks || 0;
    }
    finalObtained += q.finalAwardedMarks;
  }

  evaluation.obtainedMarks = finalObtained;
  evaluation.totalMarks = evaluation.totalMarks || exam.totalMarks || 10;
  evaluation.percentage = Number(((finalObtained / evaluation.totalMarks) * 100).toFixed(2));

  let grade = "F";
  if (evaluation.percentage >= 90) grade = "A+";
  else if (evaluation.percentage >= 80) grade = "A";
  else if (evaluation.percentage >= 70) grade = "B";
  else if (evaluation.percentage >= 60) grade = "C";
  else if (evaluation.percentage >= 50) grade = "D";
  else if (evaluation.percentage >= 40) grade = "E";

  evaluation.grade = grade;
  evaluation.evaluationStatus = "finalized";
  evaluation.updatedBy = userId;
  await evaluation.save();

  // Seal student submission status
  if (evaluation.answerSheet) {
    const ansSheetObj = await AnswerSheet.findById(evaluation.answerSheet._id);
    if (ansSheetObj) {
      ansSheetObj.submissionStatus = "Completed";
      if (ansSheetObj.submissionType === "UPLOAD") {
        ansSheetObj.uploadStatus = "Published";
      }
      await ansSheetObj.save();
    }
  }

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
  reviewQuestion,
  finalizeEvaluation,
};
