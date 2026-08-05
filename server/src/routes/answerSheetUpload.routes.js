import express from "express";
import upload from "../config/multer.js";
import answerSheetUploadController from "../controllers/answerSheetUpload.controller.js";
import {
  uploadAnswerSheetValidator,
  getUploadedAnswerSheetValidator,
  deleteUploadedAnswerSheetValidator,
} from "../validators/answerSheetUpload.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/upload",
  authorize(ROLES.STUDENT),
  upload.single("answerSheetFile"),
  uploadAnswerSheetValidator,
  validate,
  answerSheetUploadController.uploadAnswerSheet
);

router.get(
  "/:examId",
  authorize(ROLES.STUDENT),
  getUploadedAnswerSheetValidator,
  validate,
  answerSheetUploadController.getUploadedAnswerSheets
);

router.delete(
  "/:answerSheetId",
  authorize(ROLES.STUDENT),
  deleteUploadedAnswerSheetValidator,
  validate,
  answerSheetUploadController.deleteUploadedAnswerSheet
);

export default router;
