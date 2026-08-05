import dashboardService from "../services/dashboard.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const result = await dashboardService.getAdminDashboard();
  return sendSuccess(res, STATUS_CODES.OK, "Admin dashboard retrieved successfully", result);
});

export default {
  getAdminDashboard,
};
