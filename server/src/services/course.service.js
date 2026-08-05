import Course from "../models/Course.js";
import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

export const createCourse = async (data, userId) => {
  // Validate department exists
  const dept = await Department.findOne({ _id: data.department, isDeleted: false });
  if (!dept) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Department reference not found or is inactive");
  }

  const existing = await Course.findOne({
    $or: [{ name: data.name }, { code: data.code.toUpperCase() }],
    isDeleted: false,
  });
  if (existing) {
    throw new ApiError(STATUS_CODES.CONFLICT, "Course name or code already exists");
  }

  const course = await Course.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return course;
};

export const getCourseById = async (id) => {
  const course = await Course.findOne({ _id: id, isDeleted: false })
    .populate("department", "name code")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Course not found");
  }
  return course;
};

export const getAllCourses = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sort = "-createdAt",
    isActive,
    department,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (search) {
    mongoQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive !== undefined) {
    mongoQuery.isActive = isActive === "true" || isActive === true;
  }

  if (department) {
    mongoQuery.department = department;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Course.countDocuments(mongoQuery);
  const data = await Course.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("department", "name code")
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

export const updateCourse = async (id, data, userId) => {
  const course = await Course.findOne({ _id: id, isDeleted: false });
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Course not found");
  }

  if (data.department) {
    const dept = await Department.findOne({ _id: data.department, isDeleted: false });
    if (!dept) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Department reference not found or is inactive");
    }
  }

  // Check unique key conflicts
  const conflictsCheck = [];
  if (data.name && data.name !== course.name) {
    conflictsCheck.push({ name: data.name });
  }
  if (data.code && data.code.toUpperCase() !== course.code) {
    conflictsCheck.push({ code: data.code.toUpperCase() });
  }

  if (conflictsCheck.length > 0) {
    const existing = await Course.findOne({
      $or: conflictsCheck,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (existing) {
      throw new ApiError(STATUS_CODES.CONFLICT, "Course name or code already exists");
    }
  }

  if (data.name) {
    course.name = data.name; // Triggers slug regenerations in pre-save
  }

  Object.assign(course, data);
  course.updatedBy = userId;

  await course.save();
  return course;
};

export const deleteCourse = async (id, userId) => {
  const course = await Course.findOne({ _id: id, isDeleted: false });
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Course not found");
  }

  course.isDeleted = true;
  course.isActive = false;
  course.updatedBy = userId;

  await course.save();
  return course;
};

export default {
  createCourse,
  getCourseById,
  getAllCourses,
  updateCourse,
  deleteCourse,
};
