import mongoose from "mongoose";

const improvementSuggestionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam reference is required"],
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    questionNumber: {
      type: String,
      required: [true, "Question number is required"],
      trim: true,
      index: true,
    },
    questionText: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["reference_answer", "rubric", "evaluation_rule"],
      required: [true, "Suggestion type is required"],
      index: true,
    },
    sourceFeedbackIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EvaluationFeedback",
      },
    ],
    currentVersion: {
      type: Number,
      default: 1,
    },
    currentModelAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    currentRubric: [
      {
        criterion: { type: String, trim: true },
        description: { type: String, trim: true },
        maxMarks: { type: Number },
      },
    ],
    suggestedModelAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    suggestedRubric: [
      {
        criterion: { type: String, trim: true },
        description: { type: String, trim: true },
        maxMarks: { type: Number },
      },
    ],
    justification: {
      type: String,
      required: [true, "Justification is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Implemented", "Archived"],
      default: "Pending",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewComment: {
      type: String,
      trim: true,
      default: "",
    },
    createdVersion: {
      type: Number,
    },
    auditLog: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedAt: { type: Date, default: Date.now },
        comment: { type: String, default: "" },
        previousVersion: Number,
        newVersion: Number,
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "improvement_suggestions",
  }
);

const ImprovementSuggestion = mongoose.model("ImprovementSuggestion", improvementSuggestionSchema);
export default ImprovementSuggestion;
export { ImprovementSuggestion };
