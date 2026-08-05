import express from "express";
import feedbackController from "../controllers/feedback.controller.js";
import { feedbackValidator } from "../validators/feedback.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    feedbackValidator,
    validate,
    feedbackController.createFeedback
  )
  .get(feedbackController.getAllFeedback);

router
  .route("/:id")
  .get(feedbackController.getFeedbackById)
  .put(
    authorize(ROLES.STUDENT, ROLES.ADMIN),
    feedbackValidator,
    validate,
    feedbackController.updateFeedback
  )
  .delete(authorize(ROLES.ADMIN), feedbackController.deleteFeedback);

export default router;
