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
  rubricItems: [
    {
      criterion: {
        type: String,
        required: [true, "Rubric criterion name is required"],
        trim: true,
      },
      description: {
        type: String,
        default: "",
        trim: true,
      },
      maxMarks: {
        type: Number,
        required: [true, "Rubric item maxMarks is required"],
        min: [0, "Rubric item maxMarks cannot be negative"],
      },
    },
  ],
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
      values: [
        "descriptive",
        "numerical",
        "programming",
        "mcq",
        "diagram",
        "Descriptive",
        "Short Answer",
        "Long Answer",
        "MCQ",
        "True/False",
      ],
      message: "Invalid Question Type",
    },
    default: "descriptive",
  },
  evaluationConfig: {
    version: {
      type: Number,
      default: 1,
      min: [1, "Version must be at least 1"],
    },
    modelAnswer: {
      type: String,
      trim: true,
      default: "",
    },
    rubric: [
      {
        criterion: {
          type: String,
          required: [true, "Rubric criterion name is required"],
          trim: true,
        },
        description: {
          type: String,
          default: "",
          trim: true,
        },
        maxMarks: {
          type: Number,
          required: [true, "Rubric item maxMarks is required"],
          min: [0.01, "Rubric item maxMarks must be greater than 0"],
        },
      },
    ],
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
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

questionSchema.virtual("maxMarks").get(function () {
  return this.maximumMarks;
}).set(function (val) {
  this.maximumMarks = val;
});

// Custom validation rule for rubricItems / evaluationConfig sum against maximumMarks
questionSchema.pre("validate", function (next) {
  if (this.maxMarks === undefined && this.maximumMarks !== undefined) {
    // Already synced via virtual
  }
  // Validate legacy rubricItems if populated
  if (Array.isArray(this.rubricItems) && this.rubricItems.length > 0) {
    const totalRubricMarks = this.rubricItems.reduce(
      (sum, item) => sum + (Number(item.maxMarks) || 0),
      0
    );
    if (totalRubricMarks !== this.maximumMarks) {
      this.invalidate(
        "rubricItems",
        `Total rubric marks (${totalRubricMarks}) must equal question maximum marks (${this.maximumMarks})`
      );
    }
  }

  // Validate evaluationConfig.rubric if populated
  if (this.evaluationConfig && Array.isArray(this.evaluationConfig.rubric) && this.evaluationConfig.rubric.length > 0) {
    const totalEvalRubricMarks = this.evaluationConfig.rubric.reduce(
      (sum, item) => sum + (Number(item.maxMarks) || 0),
      0
    );
    if (totalEvalRubricMarks !== this.maximumMarks) {
      this.invalidate(
        "evaluationConfig.rubric",
        `Total rubric marks (${totalEvalRubricMarks}) must equal question maximum marks (${this.maximumMarks})`
      );
    }
  }

  next();
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
    passingMarks: {
      type: Number,
      min: [0, "Passing marks cannot be negative"],
    },
    passingPercentage: {
      type: Number,
      min: [0, "Passing percentage cannot be negative"],
      max: [100, "Passing percentage cannot exceed 100"],
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
