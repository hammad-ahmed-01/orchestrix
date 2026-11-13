import express from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middleware/error.middleware.js";
import { runRouter } from "./execution/run.routes.js";
import { healthRouter } from "./routes/health.route.js";
import { workflowRouter } from "./workflows/workflow.routes.js";

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
  app.use(workflowRouter);
  app.use(runRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
