import type { NodeExecutor } from "./node-executor.types.js";

export const triggerExecutor: NodeExecutor = {
  execute(_node, context) {
    return Promise.resolve({ ...context.workflowInput });
  },
};
