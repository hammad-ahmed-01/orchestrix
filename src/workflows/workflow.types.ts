export const workflowNodeTypes = [
  "trigger",
  "action",
  "http",
  "condition",
] as const;

export type WorkflowNodeType = (typeof workflowNodeTypes)[number];

export const edgeConditions = ["true", "false"] as const;

export type EdgeCondition = (typeof edgeConditions)[number];

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HttpMethod = (typeof httpMethods)[number];

export const conditionOperators = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "exists",
] as const;

export type ConditionOperator = (typeof conditionOperators)[number];

export type WorkflowStatus = "draft" | "active";

export type TriggerNode = {
  id: string;
  type: "trigger";
  name: string;
  config: Record<string, unknown>;
};

export type ActionNode = {
  id: string;
  type: "action";
  name: string;
  config: Record<string, unknown>;
};

export type HttpNodeConfig = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export type HttpNode = {
  id: string;
  type: "http";
  name: string;
  config: HttpNodeConfig;
};

export type ConditionNodeConfig = {
  left: unknown;
  operator: ConditionOperator;
  right?: unknown;
};

export type ConditionNode = {
  id: string;
  type: "condition";
  name: string;
  config: ConditionNodeConfig;
};

export type WorkflowNode = TriggerNode | ActionNode | HttpNode | ConditionNode;

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  condition?: EdgeCondition;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSummary = {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  version: number;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};
