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
