import AnswerSheet from "../models/AnswerSheet.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";
import logger from "../utils/logger.js";

export class AnswerSheetUploadService {
  async uploadAnswerSheet(examId, file, userId) {
    const exam = await Exam.findOne({ _id: examId, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam details not found");
    }

    const existingSheets = await AnswerSheet.find({
      student: userId,
      exam: examId,
      isDeleted: false,
    });

    const attemptNo = existingSheets.length + 1;

    if (existingSheets.length > 0) {
      await AnswerSheet.updateMany(
        { student: userId, exam: examId, isDeleted: false },
        { $set: { isFinalSubmission: false } }
      );
    }

    const fileUrl = `/uploads/${file.filename}`;
    const answerSheet = await AnswerSheet.create({
      student: userId,
      exam: examId,
      subject: exam.subject,
      submissionType: "UPLOAD",
      uploadedFileName: file.originalname,
      uploadedFileUrl: fileUrl,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadStatus: "Uploaded",
      attemptNo,
      isFinalSubmission: true,
      submissionStatus: "Pending AI Evaluation",
      submittedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    evaluationPipelineService.queueEvaluation(answerSheet._id, userId).catch((err) => {
      logger.error(
        `Failed to trigger AI evaluation for uploaded answer sheet ${answerSheet._id}: ${err.message}`
      );
    });

    return answerSheet;
  }

  async getUploadedAnswerSheets(examId, userId) {
    return await AnswerSheet.find({
      student: userId,
      exam: examId,
      submissionType: "UPLOAD",
      isDeleted: false,
    }).sort({ attemptNo: -1 });
  }

  async deleteUploadedAnswerSheet(answerSheetId, userId) {
    const answerSheet = await AnswerSheet.findOne({
      _id: answerSheetId,
      student: userId,
      isDeleted: false,
    });

    if (!answerSheet) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
    }

    if (answerSheet.submissionStatus === "Published") {
      throw new ApiError(
        STATUS_CODES.BAD_REQUEST,
        "Cannot delete submission. Results have already been published."
      );
    }

    answerSheet.isDeleted = true;
    answerSheet.updatedBy = userId;
    await answerSheet.save();

    if (answerSheet.isFinalSubmission) {
      const remaining = await AnswerSheet.findOne({
        student: userId,
        exam: answerSheet.exam,
        isDeleted: false,
      }).sort({ attemptNo: -1 });

      if (remaining) {
        remaining.isFinalSubmission = true;
        await remaining.save();
      }
    }

    return { success: true };
  }
}

export default new AnswerSheetUploadService();
