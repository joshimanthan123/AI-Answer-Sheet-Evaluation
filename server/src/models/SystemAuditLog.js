import mongoose from "mongoose";

const systemAuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: "System",
    },
    userRole: {
      type: String,
      trim: true,
      default: "SYSTEM",
    },
    action: {
      type: String,
      required: [true, "Audit action is required"],
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      required: [true, "Audit entity type is required"],
      trim: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      index: true,
    },
    details: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "127.0.0.1",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "WARNING", "FAILURE"],
      default: "SUCCESS",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "system_audit_logs",
  }
);

systemAuditLogSchema.index({ createdAt: -1 });
systemAuditLogSchema.index({ action: 1, entityType: 1 });
systemAuditLogSchema.index({ user: 1, createdAt: -1 });

const SystemAuditLog = mongoose.model("SystemAuditLog", systemAuditLogSchema);
export default SystemAuditLog;
export { SystemAuditLog };
