import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { InvalidRunRequestError } from "../execution/execution.errors.js";
import {
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "../workflows/workflow.errors.js";

interface JsonParseError extends SyntaxError {
  status: number;
  type: string;
}

function isJsonParseError(err: unknown): err is JsonParseError {
  return (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === 400 &&
    "type" in err &&
    err.type === "entity.parse.failed"
  );
}

export const notFoundMiddleware: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    },
  });
};

export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isJsonParseError(err)) {
    logger.warn(
      { method: req.method, url: req.originalUrl },
      "Rejected a request with invalid JSON",
    );

    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON body.",
      },
    });
    return;
  }

  if (err instanceof WorkflowValidationError) {
    logger.warn(
      { method: req.method, url: req.originalUrl, details: err.details },
      err.message,
    );

    res.status(400).json({
      error: {
        code: "INVALID_WORKFLOW",
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof InvalidRunRequestError) {
    logger.warn(
      { method: req.method, url: req.originalUrl, details: err.details },
      err.message,
    );

    res.status(400).json({
      error: {
        code: "INVALID_RUN_REQUEST",
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof WorkflowNotFoundError) {
    logger.warn({ method: req.method, url: req.originalUrl }, err.message);

    res.status(404).json({
      error: {
        code: "WORKFLOW_NOT_FOUND",
        message: err.message,
      },
    });
    return;
  }

  logger.error(
    { err, method: req.method, url: req.originalUrl },
    "Unexpected error",
  );

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
