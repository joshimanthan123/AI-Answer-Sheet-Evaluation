import mongoose from "mongoose";

const answerItemSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Question reference is required"],
  },
  handwrittenData: {
    type: String, // Canvas SVG/JSON stroke path or placeholder
    trim: true,
  },
  recognizedText: {
    type: String,
    default: "",
    trim: true,
  },
  hwrStatus: {
    type: String,
    enum: ["Pending", "Processing", "Completed", "Failed"],
    default: "Pending",
  },
  submissionTime: {
    type: Date,
    default: Date.now,
  },
  confidenceLevel: {
    type: String,
    enum: ["HIGH", "MEDIUM", "LOW"],
    default: "HIGH",
    trim: true,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1.0,
  },
  ocrQualityStatus: {
    type: String,
    enum: ["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"],
    default: "HIGH",
    trim: true,
  },
  needsReview: {
    type: Boolean,
    default: false,
  },
  provider: {
    type: String,
    default: "paddle",
  },
  qualityReasons: {
    type: [String],
    default: [],
  },
  evaluation: {
    status: {
      type: String,
      enum: ["pending", "evaluating", "completed", "failed"],
      default: "pending",
    },
    aiEvaluation: {
      marksAwarded: { type: Number, default: 0 },
      maxMarks: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      criteria: [
        {
          criterion: { type: String, trim: true },
          marksAwarded: { type: Number, default: 0 },
          maxMarks: { type: Number, default: 0 },
          status: {
            type: String,
            enum: ["met", "partial", "missing", "pending"],
            default: "pending",
          },
          reason: { type: String, trim: true, default: "" },
        },
      ],
      matchedConcepts: { type: [String], default: [] },
      missingConcepts: { type: [String], default: [] },
      feedback: { type: String, trim: true, default: "" },
      confidence: { type: Number, default: 1.0 },
      evaluatedAt: { type: Date },
    },
    facultyEvaluation: {
      status: {
        type: String,
        enum: ["pending", "approved", "modified", "re_evaluation_requested"],
        default: "pending",
      },
      finalMarks: { type: Number },
      comment: { type: String, trim: true, default: "" },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  },
});

const answerSheetSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject reference is required"],
      index: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam reference is required"],
      index: true,
    },
    submittedAt: {
      type: Date,
    },
    submissionStatus: {
      type: String,
      enum: {
        values: [
          "Pending",
          "Processing",
          "Completed",
          "Failed",
          "Draft",
          "Started",
          "Auto Saving",
          "Submitted",
          "Pending AI Evaluation",
          "Faculty Review",
          "Published",
        ],
        message: "Invalid submission status",
      },
      default: "Pending",
      index: true,
    },
    lastSavedAt: {
      type: Date,
    },
    deviceInfo: {
      type: String,
      default: "",
    },
    answers: {
      type: [answerItemSchema],
      default: [],
    },
    submissionType: {
      type: String,
      enum: ["DIGITAL", "UPLOAD"],
      default: "DIGITAL",
      index: true,
    },
    uploadedFileName: {
      type: String,
      trim: true,
    },
    uploadedFileUrl: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    uploadStatus: {
      type: String,
      enum: [
        "Uploading",
        "Uploaded",
        "HWR Processing",
        "AI Evaluation",
        "Faculty Review",
        "Published",
        "Failed",
      ],
      index: true,
    },
    attemptNo: {
      type: Number,
      default: 1,
    },
    isFinalSubmission: {
      type: Boolean,
      default: true,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    studentIdentifier: {
      type: String,
      trim: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    processingStatus: {
      type: String,
      enum: ["uploaded", "processing", "completed", "failed", "ready_for_evaluation"],
      default: "uploaded",
      index: true,
    },
    ocrStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    segmentationStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    pages: [
      {
        pageNumber: Number,
        originalFileReference: String,
        processedFileReference: String,
        width: Number,
        height: Number,
        processingStatus: String,
      },
    ],
    extractedText: {
      type: String,
      trim: true,
    },
    digital_answers: [
      {
        question_number: String,
        question_id: mongoose.Schema.Types.ObjectId,
        question_text: String,
        max_marks: Number,
        text: String,
        answer_text: String,
        recognizedText: String,
        handwrittenData: String,
        strokes: Array,
        page_number: Number,
        confidence: Number,
        evaluation: {
          status: {
            type: String,
            enum: ["pending", "evaluating", "completed", "failed"],
            default: "pending",
          },
          aiEvaluation: {
            marksAwarded: { type: Number, default: 0 },
            maxMarks: { type: Number, default: 0 },
            percentage: { type: Number, default: 0 },
            criteria: Array,
            matchedConcepts: Array,
            missingConcepts: Array,
            feedback: String,
            confidence: Number,
            evaluatedAt: Date,
          },
          facultyEvaluation: {
            status: { type: String, enum: ["pending", "approved", "modified", "re_evaluation_requested"], default: "pending" },
            finalMarks: Number,
            comment: String,
            reviewedAt: Date,
            reviewedBy: mongoose.Schema.Types.ObjectId,
          },
        },
      },
    ],
    evaluationStatus: {
      type: String,
      enum: [
        "READY_FOR_EVALUATION",
        "AWAITING_ANSWER_KEY",
        "QUEUED_FOR_EVALUATION",
        "LOADING_ANSWER_KEY",
        "BUILDING_PROMPT",
        "AI_EVALUATING",
        "VALIDATING_RESULT",
        "EVALUATION_COMPLETED",
        "EVALUATION_FAILED",
        "PARTIALLY_EVALUATED",
        "READY_FOR_FACULTY_REVIEW",
        "ready_for_finalization",
        "finalized",
        "FINALIZED",
      ],
      default: "READY_FOR_EVALUATION",
      index: true,
    },
    evaluationProgress: {
      type: Number,
      default: 0,
    },
    evaluationCurrentStep: {
      type: String,
      default: null,
    },
    evaluationError: {
      type: String,
      default: null,
    },
    evaluationStartedAt: {
      type: Date,
    },
    evaluationCompletedAt: {
      type: Date,
    },
    evaluationAttempt: {
      type: Number,
      default: 0,
    },
    evaluationSummary: {
      totalQuestions: { type: Number, default: 0 },
      evaluatedQuestions: { type: Number, default: 0 },
      failedQuestions: { type: Number, default: 0 },
      totalMaximumMarks: { type: Number, default: 0 },
      totalAwardedMarks: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
    },
    reviewStatus: {
      type: String,
      enum: [
        "NOT_READY",
        "READY_FOR_FACULTY_REVIEW",
        "FACULTY_REVIEW_IN_PROGRESS",
        "REVISION_REQUIRED",
        "APPROVED",
        "FINALIZED",
        "READY_FOR_RESULT_PUBLICATION",
        "RESULT_PUBLISHED",
        "RESULT_UNPUBLISHED",
        "READY_FOR_EVALUATION", // Keep from old transitions just in case
      ],
      default: "NOT_READY",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewStartedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
    finalizedAt: {
      type: Date,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resultPublication: {
      status: {
        type: String,
        enum: [
          "NOT_READY",
          "READY_FOR_RESULT_PUBLICATION",
          "RESULT_PUBLISHED",
          "RESULT_UNPUBLISHED"
        ],
        default: "NOT_READY",
        index: true,
      },
      publishedAt: {
        type: Date,
        default: null
      },
      publishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      unpublishedAt: {
        type: Date,
        default: null
      },
      unpublishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      publicationComment: {
        type: String,
        default: null
      }
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const AnswerSheet = mongoose.model("AnswerSheet", answerSheetSchema);
export default AnswerSheet;
export { AnswerSheet };
