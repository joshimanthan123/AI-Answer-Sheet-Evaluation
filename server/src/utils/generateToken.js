import jwt from "jsonwebtoken";
import env from "../config/env.js";

/**
 * Generate an Access Token
 * @param {Object} payload User identity metadata
 * @returns {string} Signed JWT Access Token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT.ACCESS_SECRET, {
    expiresIn: env.JWT.ACCESS_EXPIRY,
  });
};

/**
 * Generate a Refresh Token
 * @param {Object} payload User identity metadata
 * @returns {string} Signed JWT Refresh Token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT.REFRESH_SECRET, {
    expiresIn: env.JWT.REFRESH_EXPIRY,
  });
};
