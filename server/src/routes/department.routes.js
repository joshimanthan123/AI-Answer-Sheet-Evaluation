import express from "express";
import departmentController from "../controllers/department.controller.js";
import { departmentValidator } from "../validators/department.validator.js";
import validate from "../middleware/validation.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(
    authorize(ROLES.ADMIN),
    departmentValidator,
    validate,
    departmentController.createDepartment
  )
  .get(departmentController.getAllDepartments);

router
  .route("/:id")
  .get(departmentController.getDepartmentById)
  .put(authorize(ROLES.ADMIN), departmentValidator, validate, departmentController.updateDepartment)
  .delete(authorize(ROLES.ADMIN), departmentController.deleteDepartment);

export default router;
