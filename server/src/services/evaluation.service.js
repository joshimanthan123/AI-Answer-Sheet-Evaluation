import Evaluation from "../models/Evaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

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

export default {
  createEvaluation,
  getEvaluationById,
  getAllEvaluations,
  updateEvaluation,
  deleteEvaluation,
};
