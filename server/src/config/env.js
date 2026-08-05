import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Set up directory name resolution for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the root of server/
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Validate required environment variables and assign fallback constants
const requiredEnv = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  // Rather than crashing in test/dev, we log standard warning or throw in prod
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing mandatory environment variables: ${missingEnv.join(", ")}`);
  } else {
    // Inject fallback keys for easy local development
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || "default_local_dev_access_secret_1234567890";
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "default_local_dev_refresh_secret_1234567890";
    // eslint-disable-next-line no-console
    console.warn(
      `[Config Warning] Missing local secrets ${missingEnv.join(", ")}, fallback defaults applied.`
    );
  }
}

const env = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/ai_evaluation_db",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
    REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
  },
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // Default 10MB
  ALLOWED_FILE_EXTENSIONS: (process.env.ALLOWED_FILE_EXTENSIONS || "pdf,png,jpg,jpeg").split(","),
  AI: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    LLM_MODEL_NAME: process.env.LLM_MODEL_NAME || "gpt-4o",
    AI_TIMEOUT: parseInt(process.env.AI_TIMEOUT || "30000", 10),
    SIMILARITY_THRESHOLD: parseFloat(process.env.SIMILARITY_THRESHOLD || "0.7"),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || "3", 10),
    HWR_PROVIDER: process.env.HWR_PROVIDER || "mock",
  },
};

export default env;
