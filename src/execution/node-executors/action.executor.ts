import { z } from "zod";
import { NodeExecutionError } from "../execution.errors.js";
import type { NodeExecutor } from "./node-executor.types.js";

const setActionConfigSchema = z.object({
  operation: z.literal("set"),
  values: z.record(z.string(), z.unknown()),
});

export const actionExecutor: NodeExecutor = {
  execute(node) {
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

    return Promise.resolve({ ...parsed.data.values });
  },
};

function readOperation(config: Record<string, unknown>): unknown {
  return config.operation;
}
