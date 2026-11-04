import env from "./env.js";

const allowedOrigins = (env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""));

const defaultWhitelist = ["http://localhost:5173", "http://127.0.0.1:5173"];
const whitelist = Array.from(new Set([...allowedOrigins, ...defaultWhitelist]));

const corsOptions = {
  origin: (origin, callback) => {
    // Treat undefined/null origins (like same-origin server-side, curl) as allowed
    const normalizedOrigin = origin ? origin.replace(/\/$/, "") : null;
    if (!normalizedOrigin || whitelist.includes(normalizedOrigin) || env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(new Error(`Origin Not Allowed by CORS Policies: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-User-Id",
    "X-User-Role",
  ],
  optionsSuccessStatus: 200,
};

export default corsOptions;
