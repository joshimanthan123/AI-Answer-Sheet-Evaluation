import mongoose from "mongoose";

const parsedAnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  questionNumber: {
    type: Number,
    required: [true, "parsed questionNumber is required"],
  },
  questionText: {
    type: String,
    trim: true,
  },
  answerText: {
    type: String,
    required: [true, "parsed answerText is required"],
    trim: true,
  },
  maximumMarks: {
    type: Number,
  },
  rubric: [
    {
      criteria: { type: String, trim: true },
      marks: { type: Number },
    },
  ],
  keywords: [
    {
      type: String,
      trim: true,
    },
  ],
});

const answerKeySchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam reference is required"],
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by reference is required"],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
    },
    extractedText: {
      type: String,
      trim: true,
    },
    parsedAnswers: {
      type: [parsedAnswerSchema],
      default: [],
    },
    uploadStatus: {
      type: String,
      enum: {
        values: [
          "Uploading",
          "Extracting Text",
          "Parsing Questions",
          "Ready for Review",
          "Approved",
          "Failed",
        ],
        message: "Invalid upload status",
      },
      default: "Uploading",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const AnswerKey = mongoose.model("AnswerKey", answerKeySchema);
export default AnswerKey;
export { AnswerKey };
