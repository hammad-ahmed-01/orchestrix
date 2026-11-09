export type ExecutionContext = {
  workflowInput: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
};

export function createExecutionContext(
  workflowInput: Record<string, unknown>,
): ExecutionContext {
  return {
    workflowInput,
    nodeOutputs: {},
  };
}

export function storeNodeOutput(
  context: ExecutionContext,
  nodeId: string,
  output: unknown,
): void {
  context.nodeOutputs[nodeId] = output;
}
