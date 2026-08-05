import express from "express";
import upload from "../config/multer.js";
import answerKeyController from "../controllers/answerKey.controller.js";
import {
  getAnswerKeyValidator,
  approveAnswerKeyValidator,
  updateAnswerKeyValidator,
  deleteAnswerKeyValidator,
} from "../validators/answerKey.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLES.FACULTY, ROLES.ADMIN));

router.post("/upload", upload.single("answerKeyFile"), answerKeyController.uploadAnswerKey);

router.get("/:examId", getAnswerKeyValidator, validate, answerKeyController.getAnswerKey);

router.put(
  "/:answerKeyId",
  updateAnswerKeyValidator,
  validate,
  answerKeyController.updateAnswerKey
);

router.post(
  "/approve/:answerKeyId",
  approveAnswerKeyValidator,
  validate,
  answerKeyController.approveAnswerKey
);

router.delete(
  "/:answerKeyId",
  deleteAnswerKeyValidator,
  validate,
  answerKeyController.deleteAnswerKey
);

export default router;
