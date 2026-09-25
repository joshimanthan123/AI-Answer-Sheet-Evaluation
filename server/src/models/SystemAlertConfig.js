import mongoose from "mongoose";

const systemAlertConfigSchema = new mongoose.Schema(
  {
    ocrFailureRateThreshold: {
      type: Number,
      default: 10, // percentage
      min: 0,
      max: 100,
    },
    evaluationFailureRateThreshold: {
      type: Number,
      default: 5, // percentage
      min: 0,
      max: 100,
    },
    pendingEvaluationCountThreshold: {
      type: Number,
      default: 20, // pending count
      min: 0,
    },
    highOverrideRateThreshold: {
      type: Number,
      default: 25, // percentage
      min: 0,
      max: 100,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "system_alert_configs",
  }
);

const SystemAlertConfig = mongoose.model("SystemAlertConfig", systemAlertConfigSchema);
export default SystemAlertConfig;
export { SystemAlertConfig };
