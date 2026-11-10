import { z } from "zod";
import { conditionOperators } from "../../workflows/workflow.types.js";
import { NodeExecutionError } from "../execution.errors.js";
import { resolveValue } from "../execution.resolver.js";
import type { NodeExecutor } from "./node-executor.types.js";

const conditionConfigSchema = z.object({
  left: z.unknown(),
  operator: z.enum(conditionOperators),
  right: z.unknown().optional(),
});

export const conditionExecutor: NodeExecutor = {
  execute(node, context) {
    const parsed = conditionConfigSchema.safeParse(node.config);

    if (!parsed.success) {
      throw new NodeExecutionError(
        "INVALID_NODE_CONFIGURATION",
        `Condition node "${node.id}" has invalid configuration`,
      );
    }

    const left =
      parsed.data.operator === "exists"
        ? resolveExistsLeft(parsed.data.left, context)
        : resolveValue(parsed.data.left, context);
    const right =
      parsed.data.operator === "exists"
        ? undefined
        : resolveValue(parsed.data.right, context);

    try {
      const result = evaluateCondition(parsed.data.operator, left, right);
      return Promise.resolve({ result });
    } catch (error) {
      if (error instanceof NodeExecutionError) {
        throw error;
      }

      throw new NodeExecutionError(
        "CONDITION_EVALUATION_FAILED",
        error instanceof Error ? error.message : "Condition evaluation failed",
      );
    }
  },
};

function resolveExistsLeft(
  left: unknown,
  context: Parameters<typeof resolveValue>[1],
): unknown {
  try {
    return resolveValue(left, context);
  } catch (error) {
    if (
      error instanceof NodeExecutionError &&
      error.code === "VALUE_RESOLUTION_FAILED"
    ) {
      return undefined;
    }

    throw error;
  }
}

function evaluateCondition(
  operator: (typeof conditionOperators)[number],
  left: unknown,
  right: unknown,
): boolean {
  switch (operator) {
    case "equals":
      return Object.is(left, right);
    case "not_equals":
      return !Object.is(left, right);
    case "greater_than":
      return compareNumbers(left, right) > 0;
    case "greater_than_or_equal":
      return compareNumbers(left, right) >= 0;
    case "less_than":
      return compareNumbers(left, right) < 0;
    case "less_than_or_equal":
      return compareNumbers(left, right) <= 0;
    case "contains":
      return evaluateContains(left, right);
    case "exists":
      return left !== undefined && left !== null;
    default: {
      const _exhaustive: never = operator;
      throw new NodeExecutionError(
        "CONDITION_EVALUATION_FAILED",
        `Unsupported operator ${String(_exhaustive)}`,
      );
    }
  }
}

function compareNumbers(left: unknown, right: unknown): number {
  if (typeof left !== "number" || typeof right !== "number") {
    throw new NodeExecutionError(
      "CONDITION_EVALUATION_FAILED",
      "Numeric comparisons require number values",
    );
  }

  if (Number.isNaN(left) || Number.isNaN(right)) {
    throw new NodeExecutionError(
      "CONDITION_EVALUATION_FAILED",
      "Numeric comparisons cannot use NaN",
    );
  }

  return left - right;
}

function evaluateContains(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string") {
    return left.includes(right);
  }

  if (Array.isArray(left)) {
    return left.some((entry) => Object.is(entry, right));
  }

  throw new NodeExecutionError(
    "CONDITION_EVALUATION_FAILED",
    "contains requires a string or array on the left side",
  );
}
