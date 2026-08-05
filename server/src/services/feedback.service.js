import Feedback from "../models/Feedback.js";
import Evaluation from "../models/Evaluation.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";

export const createFeedback = async (data, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: data.student, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate evaluation exists
  const evaluation = await Evaluation.findOne({ _id: data.evaluation, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation reference not found or is inactive");
  }

  const feedback = await Feedback.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return feedback;
};

export const getFeedbackById = async (id) => {
  const feedback = await Feedback.findOne({ _id: id, isDeleted: false })
    .populate("student", "name email rollNo")
    .populate({
      path: "evaluation",
      select: "obtainedMarks totalMarks percentage grade",
      populate: {
        path: "answerSheet",
        select: "submissionStatus submittedAt",
      },
    })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!feedback) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Feedback not found");
  }
  return feedback;
};

export const getAllFeedback = async (query = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt", student, evaluation, ...filters } = query;

  const mongoQuery = { isDeleted: false };

  if (student) {
    mongoQuery.student = student;
  }

  if (evaluation) {
    mongoQuery.evaluation = evaluation;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Feedback.countDocuments(mongoQuery);
  const data = await Feedback.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("student", "name email rollNo")
    .populate({
      path: "evaluation",
      select: "obtainedMarks totalMarks percentage grade",
    })
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

export const updateFeedback = async (id, data, userId) => {
  const feedback = await Feedback.findOne({ _id: id, isDeleted: false });
  if (!feedback) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Feedback not found");
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

  if (data.evaluation) {
    const evaluation = await Evaluation.findOne({ _id: data.evaluation, isDeleted: false });
    if (!evaluation) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation reference not found");
    }
  }

  Object.assign(feedback, data);
  feedback.updatedBy = userId;

  await feedback.save();
  return feedback;
};

export const deleteFeedback = async (id, userId) => {
  const feedback = await Feedback.findOne({ _id: id, isDeleted: false });
  if (!feedback) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Feedback not found");
  }

  feedback.isDeleted = true;
  feedback.updatedBy = userId;

  await feedback.save();
  return feedback;
};

export default {
  createFeedback,
  getFeedbackById,
  getAllFeedback,
  updateFeedback,
  deleteFeedback,
};
