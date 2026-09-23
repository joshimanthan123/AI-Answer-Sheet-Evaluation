import express from "express";
import * as historicalController from "../controllers/historicalEvaluation.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(authorize(ROLES.FACULTY, ROLES.ADMIN), historicalController.createHistoricalReference)
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), historicalController.getHistoricalReferences);

router
  .route("/:id")
  .get(authorize(ROLES.FACULTY, ROLES.ADMIN), historicalController.getHistoricalReferenceById);

router
  .route("/:id/status")
  .patch(authorize(ROLES.FACULTY, ROLES.ADMIN), historicalController.updateReferenceStatus);

export default router;
