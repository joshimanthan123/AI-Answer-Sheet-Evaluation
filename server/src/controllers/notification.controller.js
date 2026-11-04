import notificationService from "../services/notification.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

export const createNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification(req.body, req.user._id);
  return sendSuccess(res, STATUS_CODES.CREATED, "Notification created successfully", result);
});

export const getNotificationById = asyncHandler(async (req, res) => {
  const result = await notificationService.getNotificationById(req.params.id);
  
  if (req.user.role !== "admin" && result.user._id.toString() !== req.user._id.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You can only view your own notifications.");
  }

  return sendSuccess(res, STATUS_CODES.OK, "Notification retrieved successfully", result);
});

export const getAllNotifications = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    req.query.user = req.user._id;
  }

  const result = await notificationService.getAllNotifications(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Notifications list retrieved successfully",
    result.data,
    result.pagination
  );
});

export const updateNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.params.id);
  
  if (req.user.role !== "admin" && notification.user._id.toString() !== req.user._id.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You can only update your own notifications.");
  }

  const result = await notificationService.updateNotification(
    req.params.id,
    req.body,
    req.user._id
  );
  return sendSuccess(res, STATUS_CODES.OK, "Notification updated successfully", result);
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.params.id);
  
  if (req.user.role !== "admin" && notification.user._id.toString() !== req.user._id.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You can only delete your own notifications.");
  }

  const result = await notificationService.deleteNotification(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Notification deleted successfully", result);
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Unread notifications count retrieved successfully", result);
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.params.id);
  
  if (req.user.role !== "admin" && notification.user._id.toString() !== req.user._id.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You can only update your own notifications.");
  }

  const result = await notificationService.markAsRead(req.params.id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "Notification marked as read", result);
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id, req.user._id);
  return sendSuccess(res, STATUS_CODES.OK, "All notifications marked as read", result);
});

export default {
  createNotification,
  getNotificationById,
  getAllNotifications,
  getUnreadCount,
  markAsRead,
  updateNotification,
  deleteNotification,
  markAllAsRead,
};
