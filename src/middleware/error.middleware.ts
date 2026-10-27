import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";

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
