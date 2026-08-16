import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import {
  uploadAnswerSheets,
  getExamAnswerSheets,
  retryAnswerSheet,
  deleteAnswerSheet,
} from "../services/answerSheet.service.js";
import logger from "../utils/logger.js";

async function runTests() {
  logger.info("Initializing Answer Sheet pipeline verification tests...");

  try {
    // 1. Check schemas
    const fields = Object.keys(AnswerSheet.schema.paths);
    const expectedFields = [
      "studentIdentifier",
      "facultyId",
      "processingStatus",
      "pages",
      "extractedText",
    ];
    for (const field of expectedFields) {
      if (!fields.includes(field)) {
        throw new Error(`Schema validation failed. Missing expected field: ${field}`);
      }
    }
    logger.info("✅ AnswerSheet Mongoose Schema contains all expected Phase 7 fields.");

    // 2. Check service functions
    if (typeof uploadAnswerSheets !== "function")
      throw new Error("uploadAnswerSheets service method not exported.");
    if (typeof getExamAnswerSheets !== "function")
      throw new Error("getExamAnswerSheets service method not exported.");
    if (typeof retryAnswerSheet !== "function")
      throw new Error("retryAnswerSheet service method not exported.");
    if (typeof deleteAnswerSheet !== "function")
      throw new Error("deleteAnswerSheet service method not exported.");
    logger.info("✅ All answer sheet service methods are exported correctly.");

    logger.info("🎉 All service structure checkpoints passed successfully!");
  } catch (err) {
    logger.error(`❌ Verification tests failed: ${err.message}`);
    process.exit(1);
  }
}

// Check database connection status or run immediately
if (mongoose.connection.readyState === 1) {
  runTests();
} else {
  // Dry run checkpoints only
  runTests().then(() => process.exit(0));
}
