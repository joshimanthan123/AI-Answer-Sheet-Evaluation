import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";

/**
 * Role authorization validator middleware
 * @param {...string} allowedRoles Allowed user role roles
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(STATUS_CODES.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
    }

    next();
  };
};

export default authorize;
