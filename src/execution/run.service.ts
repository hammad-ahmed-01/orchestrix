import { getWorkflow } from "../workflows/workflow.service.js";
import { RunNotFoundError } from "./run.errors.js";
import {
  runStore,
  type WorkflowRunDetail,
  type WorkflowRunSummary,
} from "./run.store.js";

export function listRuns(): WorkflowRunSummary[] {
  return runStore.listRuns();
}

export function listRunsForWorkflow(workflowId: string): WorkflowRunSummary[] {
  getWorkflow(workflowId);
  return runStore.listRunsByWorkflowId(workflowId);
}

export function getRun(id: string): WorkflowRunDetail {
  const run = runStore.findById(id);

  if (run === undefined) {
    throw new RunNotFoundError();
  }

  return run;
}
