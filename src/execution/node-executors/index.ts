import type { WorkflowNodeType } from "../../workflows/workflow.types.js";
import { UnsupportedNodeTypeError } from "../execution.errors.js";
import { actionExecutor } from "./action.executor.js";
import type { NodeExecutor } from "./node-executor.types.js";
import { triggerExecutor } from "./trigger.executor.js";

const executors: Record<WorkflowNodeType, NodeExecutor> = {
  trigger: triggerExecutor,
  action: actionExecutor,
};

export function getNodeExecutor(nodeType: string): NodeExecutor {
  if (!isWorkflowNodeType(nodeType)) {
    throw new UnsupportedNodeTypeError(nodeType);
  }

  return executors[nodeType];
}

function isWorkflowNodeType(value: string): value is WorkflowNodeType {
  return value === "trigger" || value === "action";
}
