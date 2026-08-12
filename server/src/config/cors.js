import env from "./env.js";

const whitelist = [env.CORS_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"];

const corsOptions = {
  origin: (origin, callback) => {
    // Treat undefined/null origins (like mobile apps, curl requests) as allowed
    if (!origin || whitelist.indexOf(origin) !== -1 || env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(new Error(`Origin Not Allowed by CORS Policies: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-User-Id", "X-User-Role"],
  optionsSuccessStatus: 200,
};

export default corsOptions;
