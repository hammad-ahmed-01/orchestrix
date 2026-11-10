import { z } from "zod";
import { logger } from "../../config/logger.js";
import {
  httpMethods,
  type HttpNodeConfig,
} from "../../workflows/workflow.types.js";
import { NodeExecutionError } from "../execution.errors.js";
import { resolveValue } from "../execution.resolver.js";
import type { NodeExecutor } from "./node-executor.types.js";

const DEFAULT_TIMEOUT_MS = 10_000;

const httpConfigSchema = z.object({
  method: z.enum(httpMethods),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(100).max(30_000).default(DEFAULT_TIMEOUT_MS),
});

export const httpExecutor: NodeExecutor = {
  async execute(node, context) {
    const parsed = httpConfigSchema.safeParse(node.config);

    if (!parsed.success) {
      throw new NodeExecutionError(
        "INVALID_NODE_CONFIGURATION",
        `HTTP node "${node.id}" has invalid configuration`,
      );
    }

    const config = parsed.data;
    const urlValue = resolveValue(config.url, context);

    if (typeof urlValue !== "string") {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        `HTTP node "${node.id}" url must resolve to a string`,
      );
    }

    const url = validateResolvedUrl(urlValue);
    const headers = resolveHeaders(config.headers, context);
    const body =
      config.body === undefined
        ? undefined
        : resolveValue(config.body, context);

    return sendHttpRequest({
      nodeId: node.id,
      config,
      url,
      headers,
      body,
    });
  },
};

function resolveHeaders(
  headers: Record<string, string> | undefined,
  context: Parameters<typeof resolveValue>[1],
): Record<string, string> | undefined {
  if (headers === undefined) {
    return undefined;
  }

  const resolved = resolveValue(headers, context);

  if (!isPlainObject(resolved)) {
    throw new NodeExecutionError(
      "VALUE_RESOLUTION_FAILED",
      "HTTP headers must resolve to an object",
    );
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value !== "string") {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        `HTTP header "${key}" must resolve to a string`,
      );
    }

    result[key] = value;
  }

  return result;
}

function validateResolvedUrl(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new NodeExecutionError(
      "INVALID_NODE_CONFIGURATION",
      "HTTP URL must be a valid http or https URL",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new NodeExecutionError(
      "INVALID_NODE_CONFIGURATION",
      "HTTP URL must use http or https",
    );
  }

  return parsed;
}

async function sendHttpRequest(params: {
  nodeId: string;
  config: HttpNodeConfig & { timeoutMs: number };
  url: URL;
  headers: Record<string, string> | undefined;
  body: unknown;
}): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, params.config.timeoutMs);
  const startedAt = Date.now();

  try {
    const init: RequestInit = {
      method: params.config.method,
      headers: params.headers,
      signal: controller.signal,
    };

    if (
      params.body !== undefined &&
      params.config.method !== "GET" &&
      params.config.method !== "DELETE"
    ) {
      if (isPlainObject(params.body) || Array.isArray(params.body)) {
        init.body = JSON.stringify(params.body);
        init.headers = {
          "content-type": "application/json",
          ...params.headers,
        };
      } else if (typeof params.body === "string") {
        init.body = params.body;
      } else {
        init.body = JSON.stringify(params.body);
        init.headers = {
          "content-type": "application/json",
          ...params.headers,
        };
      }
    }

    const response = await fetch(params.url, init);
    const durationMs = Date.now() - startedAt;
    const responseBody = await readResponseBody(response);

    logger.info(
      {
        nodeId: params.nodeId,
        method: params.config.method,
        hostname: params.url.hostname,
        status: response.status,
        durationMs,
      },
      "HTTP node request completed",
    );

    if (!response.ok) {
      throw new NodeExecutionError(
        "HTTP_RESPONSE_ERROR",
        `HTTP request failed with status ${String(response.status)}`,
      );
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: collectResponseHeaders(response),
      body: responseBody,
    };
  } catch (error) {
    if (error instanceof NodeExecutionError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new NodeExecutionError(
        "HTTP_REQUEST_TIMEOUT",
        `HTTP request timed out after ${String(params.config.timeoutMs)}ms`,
      );
    }

    throw new NodeExecutionError(
      "HTTP_REQUEST_FAILED",
      error instanceof Error ? error.message : "HTTP request failed",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new NodeExecutionError(
        "HTTP_REQUEST_FAILED",
        "HTTP response body was not valid JSON",
      );
    }
  }

  return text;
}

function collectResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
