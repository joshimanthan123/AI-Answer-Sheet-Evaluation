import SystemAuditLog from "../models/SystemAuditLog.js";

/**
 * Log a system audit event.
 */
export const logAuditEvent = async ({
  user = null,
  userName = "System",
  userRole = "SYSTEM",
  action,
  entityType,
  entityId = null,
  exam = null,
  details = "",
  metadata = null,
  ipAddress = "127.0.0.1",
  status = "SUCCESS",
}) => {
  try {
    const userId = user?._id || user || null;
    const name = userName || user?.name || "System";
    const role = userRole || user?.role || "SYSTEM";

    await SystemAuditLog.create({
      user: userId,
      userName: name,
      userRole: role,
      action,
      entityType,
      entityId,
      exam,
      details,
      metadata,
      ipAddress,
      status,
    });
  } catch (err) {
    console.error("Failed to write system audit log:", err.message);
  }
};

export default { logAuditEvent };
