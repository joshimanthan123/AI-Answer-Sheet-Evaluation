import dashboardService from "../services/dashboard.service.js";
import Evaluation from "../models/Evaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { sendSuccess } from "../helpers/response.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

export const getFacultyDashboard = asyncHandler(async (req, res) => {
  const result = await dashboardService.getFacultyDashboard(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Faculty dashboard retrieved successfully", result);
});

export const getFacultySubmissions = asyncHandler(async (req, res) => {
  const { exam, subject, student, status, date, page = 1, limit = 10 } = req.query;

  const mongoQuery = { isDeleted: false };

  if (exam) mongoQuery.exam = exam;
  if (subject) mongoQuery.subject = subject;
  if (student) mongoQuery.student = student;
  if (status) mongoQuery.submissionStatus = status;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    mongoQuery.submittedAt = { $gte: start, $lte: end };
  }

  const limitNum = Number(limit);
  const skip = (Number(page) - 1) * limitNum;

  const total = await AnswerSheet.countDocuments(mongoQuery);
  const data = await AnswerSheet.find(mongoQuery)
    .sort("-submittedAt")
    .skip(skip)
    .limit(limitNum)
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration");

  return sendSuccess(res, STATUS_CODES.OK, "Submissions list retrieved successfully", data, {
    total,
    page: Number(page),
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

export const getFacultyReviewQueue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const limitNum = Number(limit);
  const skip = (Number(page) - 1) * limitNum;

  const mongoQuery = {
    evaluationStatus: { $in: ["AI_COMPLETED", "FACULTY_REVIEW"] },
    isDeleted: false,
  };

  const total = await Evaluation.countDocuments(mongoQuery);
  const data = await Evaluation.find(mongoQuery)
    .sort("-createdAt")
    .skip(skip)
    .limit(limitNum)
    .populate({
      path: "answerSheet",
      populate: [
        { path: "student", select: "name email rollNo department" },
        { path: "exam", select: "title totalMarks duration" },
        { path: "subject", select: "name code" },
      ],
    })
    .populate("evaluatedBy", "name email");

  return sendSuccess(res, STATUS_CODES.OK, "Evaluation review queue retrieved successfully", data, {
    total,
    page: Number(page),
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

export const publishResults = asyncHandler(async (req, res) => {
  const { examId, answerSheetId } = req.body;

  if (!examId && !answerSheetId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Either examId or answerSheetId must be provided");
  }

  let updatedCount = 0;

  if (examId) {
    // 1. Publish all evaluations for an entire exam
    const answerSheets = await AnswerSheet.find({ exam: examId, isDeleted: false });
    const sheetIds = answerSheets.map((as) => as._id);

    const evaluations = await Evaluation.find({
      answerSheet: { $in: sheetIds },
      evaluationStatus: { $in: ["AI_COMPLETED", "FACULTY_REVIEW", "AI_PENDING"] },
      isDeleted: false,
    }).populate({
      path: "answerSheet",
      populate: { path: "exam", select: "title" },
    });

    for (const evalItem of evaluations) {
      evalItem.evaluationStatus = "PUBLISHED";
      evalItem.updatedBy = req.user._id;
      await evalItem.save();

      // Update answer sheet status to Published
      if (evalItem.answerSheet) {
        const sheet = await AnswerSheet.findById(evalItem.answerSheet._id);
        if (sheet) {
          sheet.submissionStatus = "Published";
          sheet.updatedBy = req.user._id;
          await sheet.save();

          // Create notification for the student
          await Notification.create({
            user: sheet.student,
            title: "Results Published",
            message: `Your results for exam "${evalItem.answerSheet.exam?.title || "Exam"}" have been published.`,
            type: "Results Published",
            createdBy: req.user._id,
            updatedBy: req.user._id,
          });
        }
      }
      updatedCount++;
    }

    logger.info(`Results published for exam ${examId} by faculty ${req.user._id}`);
  } else {
    // 2. Publish single student answer sheet evaluation
    const evaluation = await Evaluation.findOne({
      answerSheet: answerSheetId,
      isDeleted: false,
    }).populate({
      path: "answerSheet",
      populate: { path: "exam", select: "title" },
    });

    if (!evaluation) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found for this answer sheet");
    }

    evaluation.evaluationStatus = "PUBLISHED";
    evaluation.updatedBy = req.user._id;
    await evaluation.save();

    const sheet = await AnswerSheet.findById(answerSheetId);
    if (sheet) {
      sheet.submissionStatus = "Published";
      sheet.updatedBy = req.user._id;
      await sheet.save();

      // Notify student
      await Notification.create({
        user: sheet.student,
        title: "Results Published",
        message: `Your results for exam "${evaluation.answerSheet.exam?.title || "Exam"}" have been published.`,
        type: "Results Published",
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
    }
    updatedCount = 1;
    logger.info(`Results published for AnswerSheet ${answerSheetId} by faculty ${req.user._id}`);
  }

  return sendSuccess(res, STATUS_CODES.OK, `Published ${updatedCount} evaluations successfully`, {
    publishedCount: updatedCount,
  });
});

export const updateFacultyProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!name || name.trim().length < 2) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Name must be at least 2 characters long.");
  }
  if (!email) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Email address is required.");
  }

  const User = (await import("../models/User.js")).default;
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "User not found.");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check unique constraints on email
  if (normalizedEmail !== user.email) {
    const emailExist = await User.findOne({ email: normalizedEmail });
    if (emailExist) {
      throw new ApiError(
        STATUS_CODES.CONFLICT,
        "An account has already been registered with this email address."
      );
    }
  }

  user.name = name.trim();
  user.email = normalizedEmail;
  await user.save();

  return sendSuccess(res, STATUS_CODES.OK, "Profile updated successfully.", { user });
});

export const changeFacultyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "All fields are required.");
  }
  if (newPassword.length < 8) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "New password must be at least 8 characters long."
    );
  }
  if (newPassword !== confirmPassword) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Passwords do not match.");
  }

  const User = (await import("../models/User.js")).default;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "User not found.");
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "The current password you entered is incorrect.");
  }

  user.password = newPassword;
  await user.save();

  return sendSuccess(res, STATUS_CODES.OK, "Password changed successfully.");
});

export const getFacultyStudents = asyncHandler(async (req, res) => {
  const User = (await import("../models/User.js")).default;
  const students = await User.find({ role: "student", isDeleted: false })
    .select("name email department semester rollNo")
    .lean();
  
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Students list retrieved successfully",
    students || []
  );
});

export default {
  getFacultyDashboard,
  getFacultySubmissions,
  getFacultyReviewQueue,
  publishResults,
  updateFacultyProfile,
  changeFacultyPassword,
  getFacultyStudents,
};
