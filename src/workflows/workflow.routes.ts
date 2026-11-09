import { Router } from "express";
import { parseRunWorkflowBody } from "../execution/execution.schema.js";
import { runWorkflow } from "../execution/execution.service.js";
import { WorkflowNotFoundError } from "./workflow.errors.js";
import { parseCreateWorkflowBody } from "./workflow.schema.js";
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
} from "./workflow.service.js";

export const workflowRouter = Router();

workflowRouter.post("/workflows", (req, res, next) => {
  try {
    const input = parseCreateWorkflowBody(req.body as unknown);
    res.status(201).json(createWorkflow(input));
  } catch (error) {
    next(error);
  }
});

workflowRouter.get("/workflows", (_req, res, next) => {
  try {
    res.status(200).json(listWorkflows());
  } catch (error) {
    next(error);
  }
});

workflowRouter.post("/workflows/:id/run", async (req, res, next) => {
  try {
    const run = await runWorkflow(
      readWorkflowId(req.params.id),
      parseRunWorkflowBody(req.body as unknown),
    );
    res.status(200).json(run);
  } catch (error) {
    next(error);
  }
});

workflowRouter.get("/workflows/:id", (req, res, next) => {
  try {
    res.status(200).json(getWorkflow(readWorkflowId(req.params.id)));
  } catch (error) {
    next(error);
  }
});

function readWorkflowId(value: string | readonly string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkflowNotFoundError();
  }

  return value;
}
