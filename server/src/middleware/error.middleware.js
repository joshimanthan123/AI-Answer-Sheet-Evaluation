import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";

/**
 * Express error handling middleware
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Check if error is an instance of ApiError, if not convert it
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode ||
      (error.name === "ValidationError"
        ? STATUS_CODES.BAD_REQUEST
        : STATUS_CODES.INTERNAL_SERVER_ERROR);

    const message = error.message || MESSAGES.SYSTEM.ERROR;
    const errorsList = error.errors || [];

    error = new ApiError(statusCode, message, errorsList, err.stack);
  }

  // Log error stack to files using our winston utility
  logger.error(
    `${req.method} ${req.url} - ${error.statusCode} - ${error.message}\nStack: ${error.stack}`
  );

  // Construct standard error layout response
  const response = {
    success: false,
    message: error.message,
    errors: error.errors || [],
    statusCode: error.statusCode,
  };

  // Detailed debug info in development
  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack;
  }

  return res.status(error.statusCode).json(response);
};

export default errorHandler;
