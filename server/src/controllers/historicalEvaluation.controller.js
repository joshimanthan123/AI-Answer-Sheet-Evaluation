import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import historicalEvaluationService from "../services/historicalEvaluation.service.js";

/**
 * POST /api/v1/historical-evaluations
 * Create historical reference snapshot for finalized answer sheet questions.
 */
export const createHistoricalReference = asyncHandler(async (req, res) => {
  const result = await historicalEvaluationService.createHistoricalReferences(
    req.body,
    req.user._id
  );
  return sendSuccess(
    res,
    STATUS_CODES.CREATED,
    "Historical evaluation reference snapshot created successfully",
    result
  );
});

/**
 * GET /api/v1/historical-evaluations
 * Retrieve historical references with metadata filters and pagination.
 */
export const getHistoricalReferences = asyncHandler(async (req, res) => {
  const result = await historicalEvaluationService.getHistoricalReferences(req.query);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Historical evaluation references retrieved successfully",
    result
  );
});

/**
 * GET /api/v1/historical-evaluations/:id
 * Get single historical evaluation reference detail.
 */
export const getHistoricalReferenceById = asyncHandler(async (req, res) => {
  const reference = await historicalEvaluationService.getHistoricalReferenceById(req.params.id);
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    "Historical evaluation reference details retrieved",
    reference
  );
});

/**
 * PATCH /api/v1/historical-evaluations/:id/status
 * Update historical evaluation reference status (approved, rejected, archived).
 */
export const updateReferenceStatus = asyncHandler(async (req, res) => {
  const { status, comment } = req.body || {};
  const reference = await historicalEvaluationService.updateReferenceStatus(
    req.params.id,
    status,
    comment,
    req.user._id
  );
  return sendSuccess(
    res,
    STATUS_CODES.OK,
    `Historical evaluation reference status updated to '${status}' successfully`,
    reference
  );
});

export default {
  createHistoricalReference,
  getHistoricalReferences,
  getHistoricalReferenceById,
  updateReferenceStatus,
};
