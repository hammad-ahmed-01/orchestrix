import { z } from "zod";
import { NodeExecutionError } from "../execution.errors.js";
import { resolveValue } from "../execution.resolver.js";
import type { NodeExecutor } from "./node-executor.types.js";

const setActionConfigSchema = z.object({
  operation: z.literal("set"),
  values: z.record(z.string(), z.unknown()),
});

export const actionExecutor: NodeExecutor = {
  execute(node, context) {
    const operation = readOperation(node.config);

    if (operation !== "set") {
      throw new NodeExecutionError(
        "UNSUPPORTED_ACTION_OPERATION",
        `Unsupported action operation "${String(operation)}"`,
      );
    }

    const parsed = setActionConfigSchema.safeParse(node.config);

    if (!parsed.success) {
      throw new NodeExecutionError(
        "INVALID_ACTION_CONFIG",
        "Action config must include a values object when operation is set",
      );
    }

    const resolved = resolveValue(parsed.data.values, context);

    if (!isPlainObject(resolved)) {
      throw new NodeExecutionError(
        "VALUE_RESOLUTION_FAILED",
        "Action values must resolve to an object",
      );
    }

    return Promise.resolve({ ...resolved });
  },
};

function readOperation(config: Record<string, unknown>): unknown {
  return config.operation;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
