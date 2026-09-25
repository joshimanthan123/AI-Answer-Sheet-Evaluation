import mongoose from "mongoose";

const systemAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: [
        "OCR_FAILURE_RATE",
        "EVALUATION_FAILURE_RATE",
        "PENDING_BACKLOG",
        "HIGH_OVERRIDE_RATE",
        "DATABASE_ISSUE",
        "API_ERROR_RATE",
      ],
      required: [true, "Alert type is required"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    actualValue: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Resolved", "Dismissed"],
      default: "Active",
      index: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "system_alerts",
  }
);

systemAlertSchema.index({ createdAt: -1 });

const SystemAlert = mongoose.model("SystemAlert", systemAlertSchema);
export default SystemAlert;
export { SystemAlert };
