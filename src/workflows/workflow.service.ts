import { randomUUID } from "node:crypto";
import {
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "./workflow.errors.js";
import { validateWorkflowGraph } from "./workflow.graph.js";
import type { CreateWorkflowInput } from "./workflow.schema.js";
import { workflowStore } from "./workflow.store.js";
import type { Workflow, WorkflowSummary } from "./workflow.types.js";

const INITIAL_WORKFLOW_VERSION = 1;

export function createWorkflow(input: CreateWorkflowInput): Workflow {
  const issues = validateWorkflowGraph(input.nodes, input.edges);

  if (issues.length > 0) {
    throw new WorkflowValidationError(issues);
  }

  const timestamp = new Date().toISOString();
  const workflow: Workflow = {
    id: randomUUID(),
    name: input.name,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    version: INITIAL_WORKFLOW_VERSION,
    status: "draft",
    nodes: input.nodes,
    edges: input.edges,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  workflowStore.save(workflow);
  return workflow;
}

export function listWorkflows(): WorkflowSummary[] {
  return workflowStore.list().map((workflow) => {
    return {
      id: workflow.id,
      name: workflow.name,
      ...(workflow.description === undefined
        ? {}
        : { description: workflow.description }),
      status: workflow.status,
      version: workflow.version,
      nodeCount: workflow.nodes.length,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  });
}

export function getWorkflow(id: string): Workflow {
  const workflow = workflowStore.findById(id);

  if (workflow === undefined) {
    throw new WorkflowNotFoundError();
  }

  return workflow;
}
