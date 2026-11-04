import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

/**
 * Sends a unified success response to the client
 * @param {Object} res Express response object
 * @param {number} statusCode HTTP Status Code
 * @param {string} message Description message
 * @param {Object|Array} data Payload data
 * @param {Object} meta Pagination or other meta properties
 */
export const sendSuccess = (res, statusCode, message, data = null, meta = null) => {
  const response = new ApiResponse(statusCode, message, data, meta);
  return res.status(statusCode).json(response);
};

/**
 * Sends a unified error response to the client
 * @param {Object} res Express response object
 * @param {number} statusCode HTTP Status Code
 * @param {string} message Description message
 * @param {Array} errors Validation or context-specific errors list
 */
export const sendError = (res, statusCode, message, errors = []) => {
  const errorObj = new ApiError(statusCode, message, errors);
  return res.status(statusCode).json({
    success: errorObj.success,
    message: errorObj.message,
    errors: errorObj.errors,
    statusCode: errorObj.statusCode,
  });
};
