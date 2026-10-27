import express from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middleware/error.middleware.js";
import { healthRouter } from "./routes/health.route.js";

export function createApp(): express.Express {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      customSuccessMessage(req, res, responseTime) {
        return `${req.method} ${req.originalUrl} ${String(res.statusCode)} ${String(responseTime)}ms`;
      },
      customErrorMessage(req, res, error) {
        return `${req.method} ${req.originalUrl} ${String(res.statusCode)} ${error.message}`;
      },
    }),
  );
  app.use(express.json());
  app.use(healthRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
