import express from "express";
import referenceAnswerController from "../controllers/referenceAnswer.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import upload from "../config/multer.js";

const router = express.Router();

// Require authentication for all reference answer routes
router.use(authMiddleware);

// Protect all reference answer routes for Faculty & Admin ONLY
// Student role is explicitly NOT included and will receive 403 Forbidden
router.use(authorize(ROLES.FACULTY, ROLES.ADMIN));

router
  .route("/upload")
  .post(upload.single("file"), referenceAnswerController.uploadReferenceAnswer);

router
  .route("/")
  .get(referenceAnswerController.getReferences)
  .post(upload.single("file"), referenceAnswerController.uploadReferenceAnswer);

router
  .route("/:id/process")
  .post(referenceAnswerController.processReference);

router
  .route("/:id/questions/:questionId")
  .put(referenceAnswerController.updateQuestionData);

router
  .route("/:id/approve")
  .post(referenceAnswerController.approveReference);

router
  .route("/:id/reject")
  .post(referenceAnswerController.rejectReference)
  .put(referenceAnswerController.rejectReference);

router
  .route("/:id")
  .get(referenceAnswerController.getReferenceById)
  .delete(referenceAnswerController.deleteReference);

export default router;
