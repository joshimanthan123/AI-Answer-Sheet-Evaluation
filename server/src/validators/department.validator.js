import { body } from "express-validator";

export const departmentValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Department name is required")
    .isLength({ max: 100 })
    .withMessage("Department name cannot exceed 100 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Department code is required")
    .isLength({ max: 20 })
    .withMessage("Department code can be at max 20 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean value"),
];

export default {
  departmentValidator,
};
