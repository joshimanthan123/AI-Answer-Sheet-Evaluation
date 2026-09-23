import mongoose from "mongoose";
import HistoricalEvaluation from "../models/HistoricalEvaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import AnswerKey from "../models/AnswerKey.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

/**
 * Creates historical evaluation reference snapshots from a finalized answer sheet.
 * Authoritative data is loaded directly from MongoDB database records.
 *
 * @param {Object} payload { answerSheetId: String, answerIds: Array<String> }
 * @param {String} userId Authenticated faculty/admin User ID
 */
export const createHistoricalReferences = async (payload, userId) => {
  const { answerSheetId, answerIds } = payload || {};

  if (!answerSheetId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "answerSheetId is required");
  }

  if (!Array.isArray(answerIds) || answerIds.length === 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "answerIds must be a non-empty array of question/answer IDs");
  }

  // 1. Fetch Authoritative AnswerSheet & Evaluation
  const answerSheet = await AnswerSheet.findById(answerSheetId)
    .populate("subject")
    .populate("exam")
    .populate("student", "name email rollNo");

  if (!answerSheet || answerSheet.isDeleted) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found or inactive.");
  }

  const evaluationDoc = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });

  // 2. Validate answer sheet finalization status
  const isSheetFinalized =
    answerSheet.evaluationStatus === "finalized" ||
    answerSheet.submissionStatus === "Published" ||
    evaluationDoc?.evaluationStatus === "finalized" ||
    evaluationDoc?.finalEvaluation?.status === "finalized";

  if (!isSheetFinalized) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Historical references can only be created from finalized answer sheets."
    );
  }

  const examDoc = answerSheet.exam;
  const subjectDoc = answerSheet.subject;

  if (!examDoc || !subjectDoc) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Associated Exam or Subject details are missing.");
  }

  // Fetch optional AnswerKey to load original model answer & rubric snapshot
  const answerKey = await AnswerKey.findOne({
    exam: examDoc._id,
    subject: subjectDoc._id,
    isDeleted: false,
  });

  const createdReferences = [];
  const errors = [];

  for (const targetAnswerId of answerIds) {
    try {
      // Locate question evaluation in Evaluation.questions array
      let qEval = null;
      if (evaluationDoc && Array.isArray(evaluationDoc.questions)) {
        qEval = evaluationDoc.questions.find(
          (q) =>
            (q._id && q._id.toString() === targetAnswerId.toString()) ||
            (q.questionId && q.questionId.toString() === targetAnswerId.toString()) ||
            (q.questionNumber && String(q.questionNumber) === String(targetAnswerId))
        );
      }

      // Locate digital answer in AnswerSheet digital_answers or answers
      let digitalAns = null;
      if (Array.isArray(answerSheet.digital_answers)) {
        digitalAns = answerSheet.digital_answers.find(
          (da) =>
            (da._id && da._id.toString() === targetAnswerId.toString()) ||
            (da.question_id && da.question_id.toString() === targetAnswerId.toString()) ||
            (da.question_number && String(da.question_number) === String(targetAnswerId))
        );
      }

      let answerItem = null;
      if (Array.isArray(answerSheet.answers)) {
        answerItem = answerSheet.answers.find(
          (a) =>
            (a._id && a._id.toString() === targetAnswerId.toString()) ||
            (a.questionId && a.questionId.toString() === targetAnswerId.toString())
        );
      }

      // Extract questionId & questionNumber
      const questionId = qEval?.questionId || digitalAns?.question_id || answerItem?.questionId || targetAnswerId;
      
      // Locate question from exam
      const examQuestion = examDoc.questions?.find(
        (eq) => eq._id.toString() === questionId.toString() || String(eq.questionNumber) === String(targetAnswerId)
      );

      const questionNumber = Number(
        qEval?.questionNumber || digitalAns?.question_number || examQuestion?.questionNumber || 1
      );

      // Locate answer key question if available
      const keyQuestion = answerKey?.questions?.find(
        (kq) =>
          (kq._id && kq._id.toString() === questionId.toString()) ||
          kq.questionNumber === questionNumber
      );

      // Determine authoritative marks awarded from faculty evaluation
      const facultyFinalMarks =
        qEval?.facultyEvaluation?.finalMarks !== undefined
          ? qEval.facultyEvaluation.finalMarks
          : qEval?.facultyAwardedMarks !== undefined
          ? qEval.facultyAwardedMarks
          : digitalAns?.evaluation?.facultyEvaluation?.finalMarks;

      if (facultyFinalMarks === undefined || facultyFinalMarks === null || isNaN(Number(facultyFinalMarks))) {
        throw new ApiError(
          STATUS_CODES.BAD_REQUEST,
          `Question Q${questionNumber} does not have finalized faculty marks.`
        );
      }

      const marksAwarded = Number(facultyFinalMarks);
      const maxMarks = Number(
        examQuestion?.maximumMarks || keyQuestion?.maxMarks || qEval?.maximumMarks || digitalAns?.max_marks || 10
      );

      const questionText = (
        examQuestion?.questionText ||
        keyQuestion?.questionText ||
        qEval?.questionText ||
        digitalAns?.question_text ||
        `Question ${questionNumber}`
      ).trim();

      const studentAnswer = (
        qEval?.studentAnswer ||
        digitalAns?.text ||
        digitalAns?.answer_text ||
        digitalAns?.recognizedText ||
        answerItem?.recognizedText ||
        ""
      ).trim();

      const ocrText = (
        qEval?.recognizedText ||
        digitalAns?.recognizedText ||
        answerItem?.recognizedText ||
        digitalAns?.text ||
        ""
      ).trim();

      const modelAnswer = (
        keyQuestion?.modelAnswer ||
        qEval?.modelAnswer ||
        examQuestion?.modelAnswer ||
        ""
      ).trim();

      const rubric = keyQuestion?.rubricItems || keyQuestion?.rubric || qEval?.aiEvaluation?.criteria || [];
      const configVersion = keyQuestion?.version || qEval?.evaluationConfigVersion || 1;

      const sourceAnswerIdStr = targetAnswerId.toString();

      // Duplicate protection check
      const existingRef = await HistoricalEvaluation.findOne({
        sourceAnswerId: sourceAnswerIdStr,
        evaluationConfigVersion: configVersion,
        referenceStatus: { $ne: "archived" },
      });

      if (existingRef) {
        throw new ApiError(
          STATUS_CODES.CONFLICT,
          `Historical reference for Question Q${questionNumber} (version ${configVersion}) already exists.`
        );
      }

      const academicYear = examDoc.academicYear || "2025-26";

      const newRef = await HistoricalEvaluation.create({
        sourceAnswerSheetId: answerSheet._id,
        sourceAnswerId: sourceAnswerIdStr,
        academicYear,
        subject: {
          id: subjectDoc._id,
          name: subjectDoc.name,
          code: subjectDoc.code || "",
        },
        exam: {
          id: examDoc._id,
          name: examDoc.title || examDoc.name || "Exam",
        },
        examName: examDoc.title || examDoc.name || "Exam",
        questionNumber,
        questionId: mongoose.isValidObjectId(questionId) ? questionId : null,
        questionText,
        studentAnswer,
        ocrText,
        modelAnswer,
        maxMarks,
        marksAwarded,
        rubric,
        evaluationConfigVersion: configVersion,
        referenceStatus: "pending_review",
        createdBy: userId,
        uploadedBy: userId,
      });

      createdReferences.push(newRef);

      // Log audit trail event if Evaluation doc exists
      if (evaluationDoc) {
        evaluationDoc.auditHistory.push({
          action: "QUESTION_REVIEWED",
          questionNumber: `Q${questionNumber}`,
          newValue: { referenceId: newRef._id, status: "pending_review" },
          comment: `Historical evaluation reference created for Question Q${questionNumber}`,
          changedBy: userId,
          changedAt: new Date(),
        });
        await evaluationDoc.save();
      }
    } catch (err) {
      errors.push({
        answerId: targetAnswerId,
        error: err.message || "Failed to create historical reference",
      });
    }
  }

  if (createdReferences.length === 0 && errors.length > 0) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, errors[0].error);
  }

  return { createdReferences, errors };
};

/**
 * Get historical evaluation references with filtering & pagination.
 */
export const getHistoricalReferences = async (query = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = "-createdAt",
    subjectId,
    academicYear,
    examId,
    questionNumber,
    referenceStatus,
  } = query;

  const mongoQuery = {};

  if (subjectId) {
    if (mongoose.isValidObjectId(subjectId)) {
      mongoQuery["subject.id"] = subjectId;
    } else {
      mongoQuery["subject.name"] = new RegExp(subjectId, "i");
    }
  }

  if (academicYear) {
    mongoQuery.academicYear = academicYear;
  }

  if (examId) {
    if (mongoose.isValidObjectId(examId)) {
      mongoQuery["exam.id"] = examId;
    } else {
      mongoQuery.examName = new RegExp(examId, "i");
    }
  }

  if (questionNumber !== undefined && questionNumber !== "") {
    mongoQuery.questionNumber = Number(questionNumber);
  }

  if (referenceStatus) {
    mongoQuery.referenceStatus = referenceStatus;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await HistoricalEvaluation.countDocuments(mongoQuery);
  const references = await HistoricalEvaluation.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("approvedBy", "name email role")
    .populate("createdBy", "name email role");

  return {
    references,
    pagination: {
      total,
      page: Number(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get single historical reference by ID
 */
export const getHistoricalReferenceById = async (id) => {
  const ref = await HistoricalEvaluation.findById(id)
    .populate("approvedBy", "name email role")
    .populate("createdBy", "name email role");

  if (!ref) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Historical evaluation reference not found.");
  }
  return ref;
};

/**
 * Update reference status (approved, rejected, archived)
 */
export const updateReferenceStatus = async (id, status, comment, userId) => {
  const validStatuses = ["approved", "rejected", "archived"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      `Invalid status. Valid values: ${validStatuses.join(", ")}`
    );
  }

  const ref = await HistoricalEvaluation.findById(id);
  if (!ref) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Historical evaluation reference not found.");
  }

  ref.referenceStatus = status;
  if (comment) ref.statusComment = comment;

  if (status === "approved") {
    ref.approvedBy = userId;
    ref.approvedAt = new Date();
  }

  await ref.save();

  // Audit logging on source evaluation if available
  if (ref.sourceAnswerSheetId) {
    const evalDoc = await Evaluation.findOne({ answerSheet: ref.sourceAnswerSheetId });
    if (evalDoc) {
      const actionType =
        status === "approved"
          ? "REVIEW_APPROVED"
          : status === "rejected"
          ? "REVISION_REQUESTED"
          : "COMMENT_ADDED";

      evalDoc.auditHistory.push({
        action: actionType,
        questionNumber: `Q${ref.questionNumber}`,
        newValue: { referenceId: ref._id, status },
        comment: comment || `Historical reference status changed to ${status}`,
        changedBy: userId,
        changedAt: new Date(),
      });
      await evalDoc.save();
    }
  }

  return ref;
};

/**
 * Helper function interface for Phase 3G adaptive evaluation retrieval.
 */
export const findApprovedReferences = async ({ subjectId, questionId, questionNumber, maxMarks }) => {
  const query = {
    referenceStatus: "approved",
  };

  if (subjectId) {
    query["subject.id"] = subjectId;
  }
  if (questionId) {
    query.questionId = questionId;
  } else if (questionNumber !== undefined) {
    query.questionNumber = Number(questionNumber);
  }
  if (maxMarks !== undefined) {
    query.maxMarks = Number(maxMarks);
  }

  return HistoricalEvaluation.find(query).sort({ createdAt: -1 }).limit(10);
};

export default {
  createHistoricalReferences,
  getHistoricalReferences,
  getHistoricalReferenceById,
  updateReferenceStatus,
  findApprovedReferences,
};
