import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  questionNumber: {
    type: Number,
    required: [true, "Question number is required"],
  },
  questionText: {
    type: String,
    required: [true, "Question text is required"],
    trim: true,
  },
  maximumMarks: {
    type: Number,
    required: [true, "Max marks for question is required"],
    min: [1, "Max marks must be at least 1"],
  },
  keywords: {
    type: [String],
    default: [],
  },
  modelAnswer: {
    type: String,
    trim: true,
  },
  rubric: {
    type: String,
    trim: true,
  },
  bloomsLevel: {
    type: String,
    enum: {
      values: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
      message: "Invalid Bloom's taxonomy level",
    },
  },
  difficulty: {
    type: String,
    enum: {
      values: ["Easy", "Medium", "Hard"],
      message: "Difficulty must be Easy, Medium, or Hard",
    },
  },
  questionType: {
    type: String,
    enum: {
      values: ["Descriptive", "Short Answer", "Long Answer", "MCQ", "True/False"],
      message: "Invalid Question Type",
    },
    default: "Descriptive",
  },
  evaluationCriteria: {
    conceptualUnderstanding: { type: Number, default: 0 },
    keywordAccuracy: { type: Number, default: 0 },
    completeness: { type: Number, default: 0 },
    correctness: { type: Number, default: 0 },
  },
  partialMarkingRules: [
    {
      criterion: { type: String, required: true },
      description: { type: String, default: "" },
      marks: { type: Number, required: true },
    },
  ],
  expectedAnswerLength: {
    type: String,
    enum: ["short", "medium", "long"],
    default: "medium",
  },
});

const examSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Exam title is required"],
      trim: true,
    },
    examType: {
      type: String,
      required: [true, "Exam type is required"],
      trim: true,
    },
    totalMarks: {
      type: Number,
      required: [true, "Total marks is required"],
      min: [1, "Total marks must be at least 1"],
    },
    duration: {
      type: Number,
      required: [true, "Duration (minutes) is required"],
      min: [1, "Duration must be at least 1 minute"],
    },
    examDate: {
      type: Date,
      required: [true, "Exam date is required"],
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    examStatus: {
      type: String,
      enum: {
        values: ["Draft", "Published", "Active", "Completed"],
        message: "Invalid exam status",
      },
      default: "Draft",
    },
    answerKeyStatus: {
      type: String,
      enum: ["draft", "complete", "locked"],
      default: "draft",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    allowAutoSave: {
      type: Boolean,
      default: true,
    },
    allowLateSubmission: {
      type: Boolean,
      default: false,
    },
    submissionType: {
      type: String,
      enum: ["DigitalHandwriting"],
      default: "DigitalHandwriting",
    },
    instructions: {
      type: String,
      trim: true,
    },
    allowedMaterials: {
      type: String,
      trim: true,
      default: "",
    },
    examRules: {
      type: String,
      trim: true,
      default: "",
    },
    questions: {
      type: [questionSchema],
      required: [
        function () {
          return this.examStatus !== "Draft";
        },
        "Exam questions are required",
      ],
      validate: {
        validator: function (val) {
          if (this.examStatus === "Draft") {
            return true;
          }
          return val && val.length > 0;
        },
        message: "Exam must contain at least one question when published",
      },
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

examSchema.pre("save", function (next) {
  if (this.examStatus === "Published" || this.examStatus === "Active" || this.examStatus === "Completed") {
    this.isPublished = true;
  } else if (this.examStatus === "Draft") {
    this.isPublished = false;
  }
  next();
});

const Exam = mongoose.model("Exam", examSchema);
export default Exam;
export { Exam };
