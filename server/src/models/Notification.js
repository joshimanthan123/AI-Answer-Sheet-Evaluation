import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Target user reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          "Exam Started",
          "Exam Submitted",
          "HWR Completed",
          "AI Evaluation Completed",
          "Faculty Review Pending",
          "Results Published",
          "RESULT_PUBLISHED",
          "EVALUATION_FINALIZED",
          "EVALUATION_UPDATED",
          "REPORT_GENERATED",
          "System Notification",
          "Exam Published",
          "General Announcement",
        ],
        message: "Invalid notification type",
      },
      default: "System Notification",
      index: true,
    },
    relatedEntityType: {
      type: String,
      trim: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
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

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
export { Notification };
