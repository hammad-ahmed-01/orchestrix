import type { WorkflowNode } from "../../workflows/workflow.types.js";
import type { ExecutionContext } from "../execution.context.js";

export type NodeExecutor = {
  execute(
    node: WorkflowNode,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>>;
};
