import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Authentication middleware to verify JWT access tokens
 */
const auth = asyncHandler(async (req, res, next) => {
  let token;

  // Retrieve token from Authorization Bearer header or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED);
  }

  try {
    // Verify access token
    const decoded = jwt.verify(token, env.JWT.ACCESS_SECRET);

    // In dev, if MONGODB fails to connect and we run in Mock Mode, mock authentication check
    const isMockDB = env.NODE_ENV !== "production" && mongooseConnectionStateIsMock();

    let user;
    if (isMockDB) {
      // Return a simulated user object
      user = {
        _id: decoded.id,
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || "Default user",
        isActive: true,
      };
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user || !user.isActive) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.USER_NOT_FOUND);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, "AccessToken has expired.");
    }
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED);
  }
});

// Helper checking if db is disconnected and in mock mode
function mongooseConnectionStateIsMock() {
  // If the env runs and db.js has updated the databaseState
  import("../config/db.js")
    .then((dbModule) => {
      return dbModule.databaseState.includes("Mock");
    })
    .catch(() => false);
  return process.env.DB_MOCK_FALLBACK === "true" || !mongooseConnected();
}

function mongooseConnected() {
  return mongooseConnectionReadyState() === 1;
}

function mongooseConnectionReadyState() {
  try {
    // Dynamic import inside JS standard or check mongoose state
    return mongoose?.connection?.readyState || 0;
  } catch {
    return 0;
  }
}

export default auth;
