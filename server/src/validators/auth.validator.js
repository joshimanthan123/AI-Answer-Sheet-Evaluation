import { body } from "express-validator";
import { ROLES } from "../constants/roles.js";

export const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("role")
    .optional()
    .isIn([ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN])
    .withMessage("Role must be student, faculty, or admin"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department cannot exceed 100 characters"),

  body("employeeId")
    .if(body("role").equals(ROLES.FACULTY))
    .trim()
    .notEmpty()
    .withMessage("Employee ID is required for faculty accounts"),

  body("rollNo")
    .if(body("role").equals(ROLES.STUDENT))
    .trim()
    .notEmpty()
    .withMessage("Roll number is required for student accounts"),

  body("semester")
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage("Semester must be an integer between 1 and 8"),
];

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),
];

export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),
];

export const resetPasswordValidator = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("password")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];
