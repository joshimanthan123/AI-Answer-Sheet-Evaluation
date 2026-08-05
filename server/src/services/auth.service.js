import jwt from "jsonwebtoken";
import User from "../models/User.js";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateToken.js";

// Keep a local in-memory storage of users during local dev Mock Mode
// to support local verification even if MongoDB is not running locally.
const mockUsersDb = [];

export const registerUser = async (userData) => {
  const { email } = userData;

  // Check if we are running in mock DB mode
  const isMock = isDatabaseMockMode();

  if (isMock) {
    const existing = mockUsersDb.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new ApiError(STATUS_CODES.CONFLICT, MESSAGES.AUTH.EMAIL_ALREADY_EXISTS);
    }

    // Simulate mongoose pre-save and build the virtual object
    const newUser = {
      _id: `mock-id-${Date.now()}`,
      id: `mock-id-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role || "student",
      department: userData.department || "",
      rollNo: userData.rollNo || "",
      employeeId: userData.employeeId || "",
      semester: userData.semester || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUsersDb.push({ ...newUser, password: userData.password }); // store password plaintext for comparisons
    return newUser;
  }

  // Real Database queries
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(STATUS_CODES.CONFLICT, MESSAGES.AUTH.EMAIL_ALREADY_EXISTS);
  }

  const user = await User.create(userData);
  return user;
};

export const loginUser = async (email, password) => {
  const isMock = isDatabaseMockMode();

  let user;

  if (isMock) {
    const found = mockUsersDb.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found || found.password !== password) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    const rest = { ...found };
    delete rest.password;
    user = rest;
  } else {
    user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
  }

  if (!user.isActive) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "User account is suspended.");
  }

  // Generate tokens
  const payload = {
    id: user._id || user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { user, accessToken, refreshToken };
};

export const refreshAccessTokens = async (token) => {
  if (!token) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "Refresh Token is required");
  }

  try {
    const decoded = jwt.verify(token, env.JWT.REFRESH_SECRET);
    const isMock = isDatabaseMockMode();

    let user;
    if (isMock) {
      user = mockUsersDb.find((u) => (u._id || u.id) === decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user || !user.isActive) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, "Invalid refresh token or inactive user");
    }

    const payload = {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload); // generate a new one for rotation

    return { accessToken, refreshToken };
  } catch {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, "Invalid or expired Refresh Token");
  }
};

// Helper checking if db is disconnected and in mock mode
function isDatabaseMockMode() {
  // If the env runs and db.js has updated the databaseState
  let state = "Connected";
  import("../config/db.js")
    .then((dbModule) => {
      state = dbModule.databaseState;
    })
    .catch(() => {});
  return process.env.DB_MOCK_FALLBACK === "true" || state.includes("Mock");
}

export default {
  registerUser,
  loginUser,
  refreshAccessTokens,
};
