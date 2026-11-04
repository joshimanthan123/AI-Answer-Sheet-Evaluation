import mongoose from "mongoose";

const referenceQuestionSchema = new mongoose.Schema(
  {
    questionNumber: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Question number is required"],
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    questionText: {
      type: String,
      default: "",
      trim: true,
    },
    answerText: {
      type: String,
      default: "",
      trim: true,
    },
    maximumMarks: {
      type: Number,
      default: 0,
      min: [0, "Maximum marks cannot be negative"],
    },
    awardedMarks: {
      type: Number,
      default: 0,
      min: [0, "Awarded marks cannot be negative"],
    },
    keywords: {
      type: [String],
      default: [],
    },
    concepts: {
      type: [String],
      default: [],
    },
    partialCreditPoints: {
      type: [String],
      default: [],
    },
    facultyComment: {
      type: String,
      default: "",
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    ocrConfidence: {
      type: Number,
      default: 0,
    },
  },
  { _id: true, timestamps: false }
);

const referenceAnswerSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam reference is required"],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploader reference is required"],
      index: true,
    },
    referenceType: {
      type: String,
      enum: ["previous_year_evaluated"],
      default: "previous_year_evaluated",
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    sourceFile: {
      filename: { type: String, required: true },
      path: { type: String, required: true },
      storageReference: { type: String, default: "" },
      pages: { type: Number, default: 1 },
      mimeType: { type: String, default: "application/pdf" },
      size: { type: Number, default: 0 },
    },
    questions: {
      type: [referenceQuestionSchema],
      default: [],
    },
    processingStatus: {
      type: String,
      enum: [
        "UPLOADED",
        "PROCESSING",
        "PROCESSED",
        "VERIFICATION_PENDING",
        "APPROVED",
        "FAILED",
      ],
      default: "UPLOADED",
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    processingError: {
      type: String,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "reference_answers",
  }
);

referenceAnswerSchema.index({ examId: 1, processingStatus: 1 });
referenceAnswerSchema.index({ subjectId: 1, verificationStatus: 1 });
referenceAnswerSchema.index({ uploadedBy: 1, academicYear: 1 });

const ReferenceAnswer = mongoose.model("ReferenceAnswer", referenceAnswerSchema);
export default ReferenceAnswer;
export { ReferenceAnswer };
