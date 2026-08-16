import { Router } from "express";
import authController from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import validate from "../middleware/validation.middleware.js";
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "../validators/auth.validator.js";
import rateLimit from "express-rate-limit";

const router = Router();

// Apply rate limiting specifically to login/register auth routes (5 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests for general route usage, customized in app config
  message: "Too many login/register requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure stricter limiter for sensitive endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests (temporarily increased for testing/setup)
  message: {
    success: false,
    message: "Too many authorization attempts from this IP, please try again after 15 minutes",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Paths Configuration
router.post("/register", authLimiter, registerValidator, validate, authController.register);
router.post("/login", loginLimiter, loginValidator, validate, authController.login);
router.post("/logout", authMiddleware, authController.logout);
router.get("/profile", authMiddleware, authController.getProfile);
router.get("/me", authMiddleware, authController.getProfile);

// Token Refreshes (allows cookie-based or body payload refreshToken)
router.post("/refresh", authController.refresh);

// Password resets placeholders
router.post("/forgot-password", forgotPasswordValidator, validate, authController.forgotPassword);
router.post("/reset-password", resetPasswordValidator, validate, authController.resetPassword);

export default router;
export { router };
