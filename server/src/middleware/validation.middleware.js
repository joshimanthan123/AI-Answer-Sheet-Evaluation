import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";

/**
 * Checks for express-validator results and throws ApiError if they exist
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.VALIDATION.FAILED, extractedErrors);
  }
  next();
};

export default validate;
