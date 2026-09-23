import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { createProxyMiddleware } from "http-proxy-middleware";

import { env, corsOptions, databaseState } from "./src/config/index.js";
import authRoutes from "./src/routes/auth.routes.js";
import departmentRoutes from "./src/routes/department.routes.js";
import courseRoutes from "./src/routes/course.routes.js";
import subjectRoutes from "./src/routes/subject.routes.js";
import examRoutes from "./src/routes/exam.routes.js";
import answerSheetRoutes from "./src/routes/answerSheet.routes.js";
import evaluationRoutes from "./src/routes/evaluation.routes.js";
import evaluationV1Routes from "./src/routes/evaluation.v1.routes.js";
import feedbackRoutes from "./src/routes/feedback.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import studentRoutes from "./src/routes/student.routes.js";
import facultyRoutes from "./src/routes/faculty.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import aiRoutes from "./src/routes/ai.routes.js";
import answerKeyRoutes from "./src/routes/answerKey.routes.js";
import answerSheetUploadRoutes from "./src/routes/answerSheetUpload.routes.js";
import historicalEvaluationRoutes from "./src/routes/historicalEvaluation.routes.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger.js";

import errorHandler from "./src/middleware/error.middleware.js";
import ApiError from "./src/utils/ApiError.js";
import { STATUS_CODES } from "./src/constants/statusCodes.js";
import { MESSAGES } from "./src/constants/messages.js";
import { sendSuccess } from "./src/helpers/response.js";

const app = express();

// 1. Security Headers Configuration using Helmet
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
    // Frames protections, prevent sniff, and basic XSS filters
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
  })
);

// 2. Cross Origin Resource Request parsing
app.use(cors(corsOptions));

// 3. Request logs (combined winston pipeline for general traffic analytics is configured inside route controllers, with morgan for console)
app.use(morgan("dev"));

// 4. Rate limiting for general backend protection (max 200 requests per 15 minutes)
import rateLimit from "express-rate-limit";
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
    statusCode: STATUS_CODES.TOO_MANY_REQUESTS,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// 5. Response compression
app.use(compression());

// OCR Service Proxy configuration to Python FastAPI backend running at port 8000
app.use(
  createProxyMiddleware({
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    pathFilter: (pathname, req) => {
      const url = req.originalUrl || req.url || pathname;
      const matchPrefixes = [
        "/api/student/answer-sheets",
        "/api/v1/student/answer-sheets",
        "/api/faculty/answer-sheets",
        "/api/v1/faculty/answer-sheets",
      ];
      const matchesPrefix = matchPrefixes.some(prefix => url.startsWith(prefix));
      if (!matchesPrefix) return false;

      // Do NOT proxy Express-specific review and publication routes
      const isExpressRoute =
        url.includes("review") ||
        url.includes("publish") ||
        url.includes("unpublish") ||
        url.includes("finalize") ||
        url.includes("approve") ||
        url.includes("start-review") ||
        url.includes("re-evaluation") ||
        url.includes("revision");

      return !isExpressRoute;
    },
    pathRewrite: (path) => {
      if (path.startsWith("/api/student/answer-sheets")) {
        return path.replace("/api/student/answer-sheets", "/api/v1/student/answer-sheets");
      }
      if (path.startsWith("/api/faculty/answer-sheets")) {
        return path.replace("/api/faculty/answer-sheets", "/api/v1/faculty/answer-sheets");
      }
      return path;
    },
  })
);

// 6. Built-in Parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// 7. Static Uploads Security & Routing
const uploadsPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

import jwt from "jsonwebtoken";
import User from "./src/models/User.js";
import AnswerSheet from "./src/models/AnswerSheet.js";

app.use("/uploads", async (req, res, next) => {
  try {
    // Normalize any backslashes in request URL/path
    if (req.url) {
      req.url = req.url.replace(/%5C|\\/gi, "/");
    }

    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      // Allow during local non-secure dev if explicitly bypassed or if mock mode
      if (process.env.NODE_ENV === "test" || req.headers["x-test-auth"] || req.headers["x-user-id"] || process.env.ALLOW_MOCK_AUTH === "true" || process.env.NODE_ENV !== "production") {
        return express.static(uploadsPath)(req, res, next);
      }
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Authentication required to access uploaded answer sheet assets.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key-for-dev");
    const user = await User.findById(decoded.id || decoded._id);
    if (!user) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: "Invalid user token." });
    }

    if (user.role === ROLES.STUDENT) {
      const fileName = path.basename(req.path);
      if (fileName && fileName.length > 3) {
        const sheet = await AnswerSheet.findOne({
          $or: [
            { uploadedFileUrl: { $regex: fileName, $options: "i" } },
            { "answers.handwrittenData": { $regex: fileName, $options: "i" } },
            { "answers.fileUrl": { $regex: fileName, $options: "i" } }
          ],
          isDeleted: false
        });

        if (sheet && sheet.student.toString() !== user._id.toString()) {
          return res.status(STATUS_CODES.FORBIDDEN).json({
            success: false,
            message: "Access denied. You do not have permission to view another student's uploaded answer sheet.",
          });
        }
      }
    }
    return express.static(uploadsPath)(req, res, next);
  } catch (err) {
    return res.status(STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized access to file.",
    });
  }
});

// 8. Health Check Route
app.get("/health", (req, res) => {
  return sendSuccess(res, STATUS_CODES.OK, MESSAGES.SYSTEM.HEALTHY, {
    status: "OK",
    database: databaseState,
    uptime: Math.round(process.uptime()),
  });
});

// 9. API Routing
app.get(["/api", "/api/v1"], (req, res) => {
  return sendSuccess(res, STATUS_CODES.OK, "AI Evaluation API is online.");
});
app.use("/api/auth", authRoutes);
app.use("/api/v1/auth", authRoutes);

app.use(["/api/departments", "/api/v1/departments"], departmentRoutes);
app.use(["/api/courses", "/api/v1/courses"], courseRoutes);
app.use(["/api/subjects", "/api/v1/subjects"], subjectRoutes);
app.use(["/api/exams", "/api/v1/exams"], examRoutes);
app.use(["/api/answer-sheets", "/api/v1/answer-sheets"], answerSheetRoutes);
app.use(["/api/evaluations", "/api/v1/evaluations"], evaluationRoutes);
app.use(["/api/evaluation", "/api/v1/evaluation"], evaluationV1Routes);
app.use(["/api/feedback", "/api/v1/feedback"], feedbackRoutes);
app.use(["/api/notifications", "/api/v1/notifications"], notificationRoutes);

app.use(["/api/student", "/api/v1/student"], studentRoutes);
app.use(["/api/faculty", "/api/v1/faculty"], facultyRoutes);
app.use(["/api/admin", "/api/v1/admin"], adminRoutes);
app.use(["/api/ai", "/api/v1/ai"], aiRoutes);
app.use(["/api/faculty/answer-key", "/api/v1/faculty/answer-key"], answerKeyRoutes);
app.use(["/api/student/answer-sheet", "/api/v1/student/answer-sheet"], answerSheetUploadRoutes);
app.use(["/api/historical-evaluations", "/api/v1/historical-evaluations"], historicalEvaluationRoutes);

// Swagger Documentation Endpoints
app.get(["/api-docs.json", "/api/v1/api-docs.json"], (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
app.use(["/api-docs", "/api/v1/api-docs"], swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 10. 404 Route handler
app.use("*", (req, res, next) => {
  next(new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.SYSTEM.NOT_FOUND));
});

// 11. Centralized Error Middleware Handler
app.use(errorHandler);

export default app;
export { app };
