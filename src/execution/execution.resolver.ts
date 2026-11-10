import type { ExecutionContext } from "./execution.context.js";
import { NodeExecutionError } from "./execution.errors.js";

const EXACT_PLACEHOLDER = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const EMBEDDED_PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function resolveValue(
  value: unknown,
  context: ExecutionContext,
): unknown {
  if (typeof value === "string") {
    return resolveString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveValue(entry, context));
  }

  if (isPlainObject(value)) {
    const resolved: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = resolveValue(entry, context);
    }

    return resolved;
  }

  return value;
}

function resolveString(value: string, context: ExecutionContext): unknown {
  const exactMatch = EXACT_PLACEHOLDER.exec(value);

  if (exactMatch?.[1] !== undefined) {
    return resolvePath(exactMatch[1], context);
  }

  if (!value.includes("{{")) {
    return value;
  }

  return value.replace(EMBEDDED_PLACEHOLDER, (_match, rawPath: string) => {
    const resolved = resolvePath(rawPath, context);
    return stringifyResolvedValue(resolved);
  });
}

function resolvePath(path: string, context: ExecutionContext): unknown {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new NodeExecutionError(
      "VALUE_RESOLUTION_FAILED",
      "Value path is empty",
    );
  }

  const root = segments[0];

  if (root === "input") {
    return readPath(context.workflowInput, segments.slice(1), path);
  }

  if (root === "nodes") {
    const nodeId = segments[1];

    if (nodeId === undefined) {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        `Value path "${path}" is missing a node id`,
      );
    }

    if (!(nodeId in context.nodeOutputs)) {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        `Node output "${nodeId}" does not exist`,
      );
    }

    return readPath(context.nodeOutputs[nodeId], segments.slice(2), path);
  }

  throw new NodeExecutionError(
    "VALUE_RESOLUTION_FAILED",
    `Value path "${path}" must start with input or nodes`,
  );
}

function readPath(
  value: unknown,
  segments: readonly string[],
  originalPath: string,
): unknown {
  let current: unknown = value;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new NodeExecutionError(
          "VALUE_RESOLUTION_FAILED",
          `Value path "${originalPath}" does not exist`,
        );
      }

      current = current[index];
      continue;
    }

    if (!isPlainObject(current) || !(segment in current)) {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        `Value path "${originalPath}" does not exist`,
      );
    }

    current = current[segment];
  }

  return current;
}

function stringifyResolvedValue(value: unknown): string {
  if (value === null || value === undefined) {
    throw new NodeExecutionError(
      "VALUE_RESOLUTION_FAILED",
      "Resolved value cannot be null or undefined inside a string template",
    );
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
