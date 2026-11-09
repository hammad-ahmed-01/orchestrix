export type WorkflowRunStatus = "running" | "completed" | "failed";

export type NodeExecutionStatus = "completed" | "failed";

export type ExecutionErrorInfo = {
  code: string;
  message: string;
};

export type NodeExecutionResult = {
  nodeId: string;
  nodeType: string;
  status: NodeExecutionStatus;
  input: unknown;
  output?: unknown;
  startedAt: string;
  completedAt: string;
  error?: ExecutionErrorInfo;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  nodeResults: NodeExecutionResult[];
  startedAt: string;
  completedAt?: string;
  error?: ExecutionErrorInfo;
};
