import mongoose from "mongoose";

const questionEvaluationSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Question reference is required"],
  },
  recognizedText: {
    type: String,
    trim: true,
  },
  modelAnswer: {
    type: String,
    trim: true,
  },
  similarityScore: {
    type: Number,
    min: [0, "Similarity score cannot be negative"],
    max: [100, "Similarity score cannot exceed 100"],
  },
  aiMarks: {
    type: Number,
    default: 0,
    min: [0, "Marks cannot be negative"],
  },
  facultyMarks: {
    type: Number,
    min: [0, "Marks cannot be negative"],
  },
  feedback: {
    type: String,
    trim: true,
  },
});

const evaluationSchema = new mongoose.Schema(
  {
    answerSheet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnswerSheet",
      required: [true, "Answer sheet reference is required"],
      unique: true,
      index: true,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    evaluationType: {
      type: String,
      enum: {
        values: ["AI", "Faculty"],
        message: "Evaluation type must be AI or Faculty",
      },
      required: [true, "Evaluation type is required"],
    },
    obtainedMarks: {
      type: Number,
      required: [true, "Obtained marks is required"],
      min: [0, "Obtained marks cannot be negative"],
    },
    totalMarks: {
      type: Number,
      required: [true, "Total marks is required"],
      min: [1, "Total marks must be at least 1"],
    },
    percentage: {
      type: Number,
      required: [true, "Percentage is required"],
      min: [0, "Percentage cannot be negative"],
      max: [100, "Percentage cannot exceed 100"],
    },
    grade: {
      type: String,
      trim: true,
      uppercase: true,
    },
    evaluationStatus: {
      type: String,
      enum: {
        values: [
          "AI_PENDING",
          "HWR_PROCESSING",
          "PROMPT_GENERATION",
          "LLM_PROCESSING",
          "GRADING",
          "AI_COMPLETED",
          "FACULTY_REVIEW",
          "PUBLISHED",
          "FAILED",
        ],
        message: "Invalid evaluation status",
      },
      default: "AI_PENDING",
      index: true,
    },
    aiMetadata: {
      promptText: { type: String, trim: true },
      modelUsed: { type: String, trim: true },
      promptVersion: { type: String, trim: true },
      evaluatedAt: { type: Date },
      tokenUsage: {
        promptTokens: { type: Number, default: 0 },
        completionTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 },
      },
      durations: {
        hwrMs: { type: Number, default: 0 },
        llmMs: { type: Number, default: 0 },
        totalMs: { type: Number, default: 0 },
      },
    },
    strengths: {
      type: String,
      trim: true,
    },
    weaknesses: {
      type: String,
      trim: true,
    },
    suggestions: {
      type: String,
      trim: true,
    },
    questions: {
      type: [questionEvaluationSchema],
      default: [],
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

const Evaluation = mongoose.model("Evaluation", evaluationSchema);
export default Evaluation;
export { Evaluation };
