import mongoose from "mongoose";

const historicalEvaluationSchema = new mongoose.Schema(
  {
    sourceAnswerSheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnswerSheet",
      index: true,
    },
    sourceAnswerId: {
      type: String,
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      index: true,
    },
    subject: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
      name: { type: String, required: true, trim: true },
      code: { type: String, trim: true },
    },
    exam: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
      name: { type: String, required: true, trim: true },
    },
    examName: {
      type: String,
      trim: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      required: [true, "Question number is required"],
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    questionText: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    studentAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    ocrText: {
      type: String,
      default: "",
      trim: true,
    },
    modelAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    maxMarks: {
      type: Number,
      required: [true, "Max marks is required"],
      min: [1, "Max marks must be at least 1"],
    },
    marksAwarded: {
      type: Number,
      default: 0,
      min: [0, "Marks awarded cannot be negative"],
    },
    rubric: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    evaluationConfigVersion: {
      type: Number,
      default: 1,
    },
    referenceStatus: {
      type: String,
      enum: ["pending_review", "approved", "rejected", "archived"],
      default: "pending_review",
      index: true,
    },
    statusComment: {
      type: String,
      default: "",
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "historical_evaluations",
  }
);

historicalEvaluationSchema.index({ "subject.id": 1, questionId: 1, referenceStatus: 1 });
historicalEvaluationSchema.index({ sourceAnswerId: 1, evaluationConfigVersion: 1 });

const HistoricalEvaluation = mongoose.model("HistoricalEvaluation", historicalEvaluationSchema);
export default HistoricalEvaluation;
export { HistoricalEvaluation };

