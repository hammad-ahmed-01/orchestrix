export const workflowNodeTypes = ["trigger", "action"] as const;

export type WorkflowNodeType = (typeof workflowNodeTypes)[number];

export type WorkflowStatus = "draft" | "active";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
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
