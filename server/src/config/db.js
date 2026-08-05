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
