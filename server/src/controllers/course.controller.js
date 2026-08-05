import courseService from "../services/course.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createCourse = asyncHandler(async (req, res) => {
  const result = await courseService.createCourse(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Course created successfully", result);
});

export const getCourseById = asyncHandler(async (req, res) => {
  const result = await courseService.getCourseById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Course retrieved successfully", result);
});

export const getAllCourses = asyncHandler(async (req, res) => {
  const result = await courseService.getAllCourses(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Courses list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateCourse = asyncHandler(async (req, res) => {
  const result = await courseService.updateCourse(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Course updated successfully", result);
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const result = await courseService.deleteCourse(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Course deleted successfully", result);
});

export default {
  createCourse,
  getCourseById,
  getAllCourses,
  updateCourse,
  deleteCourse,
};
