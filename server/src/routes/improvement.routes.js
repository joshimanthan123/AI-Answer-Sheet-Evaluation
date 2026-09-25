import express from "express";
import improvementController from "../controllers/improvement.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/analytics")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), improvementController.getImprovementAnalytics);

router
  .route("/suggestions")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), improvementController.createSuggestion)
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), improvementController.getSuggestions);

router
  .route("/suggestions/:id")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), improvementController.getSuggestionDetails);

router
  .route("/suggestions/:id/review")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), improvementController.reviewSuggestion);

export default router;
