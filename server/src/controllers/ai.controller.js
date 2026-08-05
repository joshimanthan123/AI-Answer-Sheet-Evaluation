import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
import Evaluation from "../models/Evaluation.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { sendSuccess } from "../helpers/response.js";
import asyncHandler from "../utils/asyncHandler.js";

export const evaluateAnswerSheet = asyncHandler(async (req, res) => {
  const { answerSheetId } = req.params;
  const evaluation = await evaluationPipelineService.queueEvaluation(answerSheetId, req.user._id);

  return sendSuccess(
    res,
    STATUS_CODES.ACCEPTED,
    "AI evaluation started in the background",
    evaluation
  );
});

export const getEvaluationStatus = asyncHandler(async (req, res) => {
  const { evaluationId } = req.params;
  const evaluation = await Evaluation.findById(evaluationId).select(
    "evaluationStatus obtainedMarks totalMarks percentage grade aiMetadata.durations"
  );

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  return sendSuccess(res, STATUS_CODES.OK, "Evaluation status retrieved", evaluation);
});

export const getEvaluationReport = asyncHandler(async (req, res) => {
  const { evaluationId } = req.params;
  const evaluation = await Evaluation.findById(evaluationId)
    .populate({
      path: "answerSheet",
      populate: [
        { path: "student", select: "name email rollNo department" },
        { path: "exam", select: "title totalMarks duration" },
        { path: "subject", select: "name code" },
      ],
    })
    .populate("evaluatedBy", "name email");

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation not found");
  }

  return sendSuccess(res, STATUS_CODES.OK, "Evaluation report retrieved", evaluation);
});

export const retryEvaluation = asyncHandler(async (req, res) => {
  const { evaluationId } = req.params;
  const evaluation = await Evaluation.findById(evaluationId);

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation reference not found");
  }

  const retriedEval = await evaluationPipelineService.queueEvaluation(
    evaluation.answerSheet,
    req.user._id
  );

  return sendSuccess(
    res,
    STATUS_CODES.ACCEPTED,
    "AI evaluation retry initiated in the background",
    retriedEval
  );
});

export default {
  evaluateAnswerSheet,
  getEvaluationStatus,
  getEvaluationReport,
  retryEvaluation,
};
