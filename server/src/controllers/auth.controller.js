import authService from "../services/auth.service.js";
import { sendSuccess } from "../helpers/response.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { MESSAGES } from "../constants/messages.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Controller to handle user registration
 */
export const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);
  return sendSuccess(res, STATUS_CODES.CREATED, MESSAGES.AUTH.REGISTER_SUCCESS, { user });
});

/**
 * Controller to handle user login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

  // Set HTTP-only cookies for tokens
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };

  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15m
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.AUTH.LOGIN_SUCCESS, {
    user,
    token: accessToken, // Include access token in response for frontends using bearer headers
    refreshToken,
  });
});

/**
 * Controller to handle user logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear HTTP-only cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.AUTH.LOGOUT_SUCCESS);
});

/**
 * Controller to fetch authenticated user profile details
 */
export const getProfile = asyncHandler(async (req, res) => {
  // req.user has already been populated by auth middleware
  return sendSuccess(res, STATUS_CODES.OK, "Profile retrieved successfully", { user: req.user });
});

/**
 * Controller to refresh Access and Refresh tokens
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies.refreshToken;

  const { accessToken, refreshToken } = await authService.refreshAccessTokens(token);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.AUTH.REFRESH_SUCCESS, {
    token: accessToken,
    refreshToken,
  });
});

/**
 * Placeholder controller for Forgot Password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.AUTH.FORGOT_PASSWORD_SUCCESS);
});

/**
 * Placeholder controller for Reset Password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.AUTH.RESET_PASSWORD_SUCCESS);
});

export default {
  register,
  login,
  logout,
  getProfile,
  refresh,
  forgotPassword,
  resetPassword,
};
