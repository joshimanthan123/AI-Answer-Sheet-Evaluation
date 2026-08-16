import mongoose from "mongoose";
import env from "./env.js";

const MAX_RETRIES = 3;
const RETRY_INTERVAL = 3000; // 3 seconds

// Custom state tracking to allow system to run even if MongoDB server is absent
export let databaseState = "Disconnected";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  // If running in development and we want to prevent crashes if DB isn't running locally:
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s
      });
      databaseState = "Connected";
      // eslint-disable-next-line no-console
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);

      if (env.NODE_ENV !== "production") {
        try {
          const User = (await import("../models/User.js")).default;
          // Seed Test Faculty
          const facultyEmail = "faculty@test.com";
          const hasFaculty = await User.findOne({ email: facultyEmail });
          if (!hasFaculty) {
            await User.create({
              name: "Test Faculty",
              email: facultyEmail,
              password: "Password123",
              role: "faculty",
              lecturerId: "FAC001",
              employeeId: "FAC001",
              isActive: true,
            });
            // eslint-disable-next-line no-console
            console.log("[Database Seed] Created Test Faculty: faculty@test.com / Password123");
          }

          // Seed Test Student
          const studentEmail = "student@test.com";
          const hasStudent = await User.findOne({ email: studentEmail });
          if (!hasStudent) {
            await User.create({
              name: "Test Student",
              email: studentEmail,
              password: "Password123",
              role: "student",
              studentId: "STU001",
              rollNo: "STU001",
              isActive: true,
            });
            // eslint-disable-next-line no-console
            console.log("[Database Seed] Created Test Student: student@test.com / Password123");
          }
        } catch (seedErr) {
          // eslint-disable-next-line no-console
          console.error(`[Database Seed] Seeding warning: ${seedErr.message}`);
        }
      }
      return;
    } catch (error) {
      retries++;
      // eslint-disable-next-line no-console
      console.error(
        `[Database] Connection failure (attempt ${retries}/${MAX_RETRIES}): ${error.message}`
      );
      if (retries < MAX_RETRIES) {
        // eslint-disable-next-line no-console
        console.log(`[Database] Retrying in ${RETRY_INTERVAL / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
      }
    }
  }

  // Fallback behavior for local development to ensure the server still starts
  if (env.NODE_ENV !== "production") {
    databaseState = "Mock Mode (DB Unavailable)";
    // eslint-disable-next-line no-console
    console.warn("\n========================================================");
    // eslint-disable-next-line no-console
    console.warn(
      "[Database Warning] MongoDB could not be matched. Running in database simulated fallback mode."
    );
    // eslint-disable-next-line no-console
    console.warn("========================================================\n");
  } else {
    throw new Error("MongoDB Connection failed after max retries in production mode");
  }
};

export default connectDB;
