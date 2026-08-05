import Notification from "../models/Notification.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

export const createNotification = async (data, userId) => {
  const user = await User.findOne({ _id: data.user, isDeleted: false });
  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Recipient user not found or is inactive");
  }

  const notification = await Notification.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return notification;
};

export const getNotificationById = async (id) => {
  const notification = await Notification.findOne({ _id: id, isDeleted: false })
    .populate("user", "name email role")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!notification) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Notification not found");
  }
  return notification;
};

export const getAllNotifications = async (query = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt", user, read, type, ...filters } = query;

  const mongoQuery = { isDeleted: false };

  if (user) {
    mongoQuery.user = user;
  }

  if (read !== undefined) {
    mongoQuery.read = read === "true" || read === true;
  }

  if (type) {
    mongoQuery.type = type;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await Notification.countDocuments(mongoQuery);
  const data = await Notification.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("user", "name email role")
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

export const updateNotification = async (id, data, userId) => {
  const notification = await Notification.findOne({ _id: id, isDeleted: false });
  if (!notification) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Notification not found");
  }

  Object.assign(notification, data);
  notification.updatedBy = userId;

  await notification.save();
  return notification;
};

export const deleteNotification = async (id, userId) => {
  const notification = await Notification.findOne({ _id: id, isDeleted: false });
  if (!notification) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Notification not found");
  }

  notification.isDeleted = true;
  notification.updatedBy = userId;

  await notification.save();
  return notification;
};

export const markAllAsRead = async (user, userId) => {
  await Notification.updateMany(
    { user, read: false, isDeleted: false },
    { $set: { read: true, updatedBy: userId } }
  );
  return { success: true };
};

export default {
  createNotification,
  getNotificationById,
  getAllNotifications,
  updateNotification,
  deleteNotification,
  markAllAsRead,
};
