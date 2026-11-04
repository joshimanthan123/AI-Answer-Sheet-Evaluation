import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

export const createDepartment = async (data, userId) => {
  const existing = await Department.findOne({
    $or: [{ name: data.name }, { code: data.code.toUpperCase() }],
    isDeleted: false,
  });
  if (existing) {
    throw new ApiError(STATUS_CODES.CONFLICT, "Department name or code already exists");
  }

  const department = await Department.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return department;
};

export const getDepartmentById = async (id) => {
  const department = await Department.findOne({ _id: id, isDeleted: false })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!department) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Department not found");
  }
  return department;
};

export const getAllDepartments = async (query = {}) => {
  const { page = 1, limit = 10, search = "", sort = "-createdAt", isActive, ...filters } = query;

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

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Department.countDocuments(mongoQuery);
  const data = await Department.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
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

export const updateDepartment = async (id, data, userId) => {
  const department = await Department.findOne({ _id: id, isDeleted: false });
  if (!department) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Department not found");
  }

  // Check unique key conflicts
  const conflictsCheck = [];
  if (data.name && data.name !== department.name) {
    conflictsCheck.push({ name: data.name });
  }
  if (data.code && data.code.toUpperCase() !== department.code) {
    conflictsCheck.push({ code: data.code.toUpperCase() });
  }

  if (conflictsCheck.length > 0) {
    const existing = await Department.findOne({
      $or: conflictsCheck,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (existing) {
      throw new ApiError(STATUS_CODES.CONFLICT, "Department name or code already exists");
    }
  }

  // Generate slug if name changes (triggered in pre-save by set)
  if (data.name) {
    department.name = data.name;
  }

  Object.assign(department, data);
  department.updatedBy = userId;

  await department.save();
  return department;
};

export const deleteDepartment = async (id, userId) => {
  const department = await Department.findOne({ _id: id, isDeleted: false });
  if (!department) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Department not found");
  }

  department.isDeleted = true;
  department.isActive = false;
  department.updatedBy = userId;

  await department.save();
  return department;
};

export default {
  createDepartment,
  getDepartmentById,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
};
