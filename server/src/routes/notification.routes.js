import express from "express";
import notificationController from "../controllers/notification.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(notificationController.createNotification)
  .get(notificationController.getAllNotifications);

router.route("/mark-all-read").patch(notificationController.markAllAsRead);

router
  .route("/:id")
  .get(notificationController.getNotificationById)
  .put(notificationController.updateNotification)
  .delete(notificationController.deleteNotification);

export default router;
