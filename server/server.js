import app from "./app.js";
import { env, connectDB } from "./src/config/index.js";
import logger from "./src/utils/logger.js";

const startServer = async () => {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Start Express Listener
    const server = app.listen(env.PORT, () => {
      logger.info(`[Server] Ecosystem up running successfully in "${env.NODE_ENV}" environment.`);
      logger.info(`[Server] Live dashboard endpoints ready at http://localhost:${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log("\n========================================================");
      // eslint-disable-next-line no-console
      console.log(`[Server] Running successfully on Port ${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
      // eslint-disable-next-line no-console
      console.log(`[Server] API Base URL: http://localhost:${env.PORT}/api/v1`);
      // eslint-disable-next-line no-console
      console.log("========================================================\n");
    });

    // Handle system shutdown signals gracefully
    const gracefullyShutdown = (signal) => {
      logger.info(`Received ${signal}. Shutting down application gracefully.`);
      server.close(() => {
        logger.info("HTTP Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefullyShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefullyShutdown("SIGINT"));
  } catch (error) {
    logger.error(`[Server Crash] Failed to boot: ${error.message}`);
    process.exit(1);
  }
};

startServer();
