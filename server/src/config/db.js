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

          const seedAccounts = [
            {
              name: "Test Faculty",
              email: "faculty@test.com",
              password: "Password123!",
              role: "faculty",
              lecturerId: "FAC001",
              employeeId: "FAC001",
            },
            {
              name: "Test Student",
              email: "student@test.com",
              password: "Password123!",
              role: "student",
              studentId: "STU001",
              rollNo: "STU001",
            },
            {
              name: "Test Admin",
              email: "admin@test.com",
              password: "Password123!",
              role: "admin",
              employeeId: "ADM001",
            },
            {
              name: "Demo Faculty",
              email: "faculty@university.edu",
              password: "password",
              role: "faculty",
              lecturerId: "FAC-DEMO-001",
              employeeId: "FAC-DEMO-001",
            },
            {
              name: "Demo Student",
              email: "student@university.edu",
              password: "password",
              role: "student",
              studentId: "STU-DEMO-001",
              rollNo: "STU-DEMO-001",
            },
            {
              name: "Demo Admin",
              email: "admin@university.edu",
              password: "password",
              role: "admin",
              employeeId: "ADM-DEMO-001",
            },
            {
              name: "Student CE",
              email: "studentCE@gmail.com",
              password: "Password123!",
              role: "student",
              studentId: "STUDCE001",
              rollNo: "STUDCE001",
              semester: 5,
              department: "CE",
            },
            {
              name: "CE Faculty",
              email: "cefaculty@gmail.com",
              password: "Password123!",
              role: "faculty",
              lecturerId: "LECCE001",
              employeeId: "LECCE001",
              department: "CE",
            },
          ];

          for (const acc of seedAccounts) {
            let existing = await User.findOne({ email: acc.email });
            if (!existing) {
              await User.create({ ...acc, isActive: true });
              // eslint-disable-next-line no-console
              console.log(`[Database Seed] Created ${acc.role}: ${acc.email} / ${acc.password}`);
            } else {
              existing.password = acc.password;
              existing.isActive = true;
              existing.isDeleted = false;
              await existing.save();
            }
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
