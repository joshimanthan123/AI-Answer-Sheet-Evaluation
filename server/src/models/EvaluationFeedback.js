import mongoose from "mongoose";

const evaluationFeedbackSchema = new mongoose.Schema(
  {
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evaluation",
      required: [true, "Evaluation reference is required"],
      index: true,
    },
    answerSheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnswerSheet",
      index: true,
    },
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
      trim: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    aiMarks: {
      type: Number,
      required: true,
    },
    finalMarks: {
      type: Number,
      required: true,
    },
    difference: {
      type: Number,
      required: true,
    },
    feedbackType: {
      type: String,
      enum: [
        "mark_correction",
        "rubric_issue",
        "reference_answer_issue",
        "OCR_issue",
        "evaluation_logic_issue",
        "alternative_answer",
        "other",
      ],
      default: "mark_correction",
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Override reason is required"],
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    aiConfidence: {
      type: Number,
      default: 0,
    },
    ocrConfidence: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "evaluation_feedback",
  }
);

evaluationFeedbackSchema.index({ examId: 1, questionNumber: 1 });
evaluationFeedbackSchema.index({ createdAt: -1 });

const EvaluationFeedback = mongoose.model("EvaluationFeedback", evaluationFeedbackSchema);
export default EvaluationFeedback;
export { EvaluationFeedback };
