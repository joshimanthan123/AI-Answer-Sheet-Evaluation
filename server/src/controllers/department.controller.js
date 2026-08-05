import departmentService from "../services/department.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createDepartment = asyncHandler(async (req, res) => {
  const result = await departmentService.createDepartment(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Department created successfully", result);
});

export const getDepartmentById = asyncHandler(async (req, res) => {
  const result = await departmentService.getDepartmentById(req.params.id);
  return sendSuccess(res, STATUS_CODES.OK, "Department retrieved successfully", result);
});

export const getAllDepartments = asyncHandler(async (req, res) => {
  const result = await departmentService.getAllDepartments(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Departments list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const result = await departmentService.updateDepartment(req.params.id, req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Department updated successfully", result);
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const result = await departmentService.deleteDepartment(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Department deleted successfully", result);
});

export default {
  createDepartment,
  getDepartmentById,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
};
