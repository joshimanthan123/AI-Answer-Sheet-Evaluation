import express from "express";
import adminController from "../controllers/admin.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLES.ADMIN));

router.get("/dashboard", adminController.getAdminDashboard);

export default router;
