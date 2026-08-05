import Subject from "../models/Subject.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";

export const createSubject = async (data, userId) => {
  // Validate course exists
  const course = await Course.findOne({ _id: data.course, isDeleted: false });
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Course reference not found or is inactive");
  }

  // Validate faculty exists and has faculty role
  const faculty = await User.findOne({ _id: data.faculty, isDeleted: false, role: ROLES.FACULTY });
  if (!faculty) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Faculty user reference not found, is inactive, or role is invalid"
    );
  }

  const existing = await Subject.findOne({
    $or: [{ name: data.name }, { code: data.code.toUpperCase() }],
    isDeleted: false,
  });
  if (existing) {
    throw new ApiError(STATUS_CODES.CONFLICT, "Subject name or code already exists");
  }

  const subject = await Subject.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return subject;
};

export const getSubjectById = async (id) => {
  const subject = await Subject.findOne({ _id: id, isDeleted: false })
    .populate("course", "name code")
    .populate("faculty", "name email department")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject not found");
  }
  return subject;
};

export const getAllSubjects = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sort = "-createdAt",
    isActive,
    course,
    faculty,
    semester,
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

  if (course) {
    mongoQuery.course = course;
  }

  if (faculty) {
    mongoQuery.faculty = faculty;
  }

  if (semester) {
    mongoQuery.semester = Number(semester);
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Subject.countDocuments(mongoQuery);
  const data = await Subject.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("course", "name code")
    .populate("faculty", "name email department")
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

export const updateSubject = async (id, data, userId) => {
  const subject = await Subject.findOne({ _id: id, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject not found");
  }

  if (data.course) {
    const course = await Course.findOne({ _id: data.course, isDeleted: false });
    if (!course) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Course reference not found or is inactive");
    }
  }

  if (data.faculty) {
    const faculty = await User.findOne({
      _id: data.faculty,
      isDeleted: false,
      role: ROLES.FACULTY,
    });
    if (!faculty) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Faculty user reference not found or is invalid");
    }
  }

  // Check unique key conflicts
  const conflictsCheck = [];
  if (data.name && data.name !== subject.name) {
    conflictsCheck.push({ name: data.name });
  }
  if (data.code && data.code.toUpperCase() !== subject.code) {
    conflictsCheck.push({ code: data.code.toUpperCase() });
  }

  if (conflictsCheck.length > 0) {
    const existing = await Subject.findOne({
      $or: conflictsCheck,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (existing) {
      throw new ApiError(STATUS_CODES.CONFLICT, "Subject name or code already exists");
    }
  }

  if (data.name) {
    subject.name = data.name; // Triggers slug pre-save regen
  }

  Object.assign(subject, data);
  subject.updatedBy = userId;

  await subject.save();
  return subject;
};

export const deleteSubject = async (id, userId) => {
  const subject = await Subject.findOne({ _id: id, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject not found");
  }

  subject.isDeleted = true;
  subject.isActive = false;
  subject.updatedBy = userId;

  await subject.save();
  return subject;
};

export default {
  createSubject,
  getSubjectById,
  getAllSubjects,
  updateSubject,
  deleteSubject,
};
