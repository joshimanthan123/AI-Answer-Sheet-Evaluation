import referenceAnswerService from "../services/referenceAnswer.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

export class ReferenceAnswerController {
  uploadReferenceAnswer = async (req, res, next) => {
    try {
      const { examId, subjectId, academicYear, description } = req.body;
      const file = req.file || (req.files && req.files[0]);

      const result = await referenceAnswerService.uploadReferenceAnswer({
        examId,
        subjectId,
        academicYear,
        description,
        file,
        userId: req.user._id,
      });

      return sendSuccess(res, STATUS_CODES.CREATED, "Reference answer uploaded and queued for processing successfully", result);
    } catch (err) {
      next(err);
    }
  };

  getReferences = async (req, res, next) => {
    try {
      const result = await referenceAnswerService.getReferences(req.query, req.user);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answers retrieved successfully", result);
    } catch (err) {
      next(err);
    }
  };

  getReferenceById = async (req, res, next) => {
    try {
      const result = await referenceAnswerService.getReferenceById(req.params.id);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answer details retrieved successfully", result);
    } catch (err) {
      next(err);
    }
  };

  processReference = async (req, res, next) => {
    try {
      const result = await referenceAnswerService.processReferenceAnswer(req.params.id);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answer re-processed through OCR service successfully", result);
    } catch (err) {
      next(err);
    }
  };

  updateQuestionData = async (req, res, next) => {
    try {
      const { id, questionId } = req.params;
      const result = await referenceAnswerService.updateQuestionData(id, questionId, req.body);
      return sendSuccess(res, STATUS_CODES.OK, "Question extracted data updated successfully", result);
    } catch (err) {
      next(err);
    }
  };

  approveReference = async (req, res, next) => {
    try {
      const result = await referenceAnswerService.approveReference(req.params.id);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answer approved successfully", result);
    } catch (err) {
      next(err);
    }
  };

  rejectReference = async (req, res, next) => {
    try {
      const { reason } = req.body;
      const result = await referenceAnswerService.rejectReference(req.params.id, reason);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answer rejected successfully", result);
    } catch (err) {
      next(err);
    }
  };

  deleteReference = async (req, res, next) => {
    try {
      const result = await referenceAnswerService.deleteReference(req.params.id);
      return sendSuccess(res, STATUS_CODES.OK, "Reference answer deleted successfully", result);
    } catch (err) {
      next(err);
    }
  };
}

export default new ReferenceAnswerController();
