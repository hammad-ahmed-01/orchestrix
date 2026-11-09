import { randomUUID } from "node:crypto";
import { logger } from "../config/logger.js";
import { getWorkflow } from "../workflows/workflow.service.js";
import type { Workflow, WorkflowNode } from "../workflows/workflow.types.js";
import {
  createExecutionContext,
  storeNodeOutput,
  type ExecutionContext,
} from "./execution.context.js";
import { NodeExecutionError } from "./execution.errors.js";
import { findTerminalNodeIds, getExecutionOrder } from "./execution.order.js";
import type { RunWorkflowInput } from "./execution.schema.js";
import type { NodeExecutionResult, WorkflowRun } from "./execution.types.js";
import { getNodeExecutor } from "./node-executors/index.js";

export async function runWorkflow(
  workflowId: string,
  request: RunWorkflowInput,
): Promise<WorkflowRun> {
  const workflow = getWorkflow(workflowId);
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const context = createExecutionContext(request.input);
  const nodeResults: NodeExecutionResult[] = [];
  const nodesById = new Map(
    workflow.nodes.map((node) => [node.id, node] as const),
  );

  logger.info({ workflowId: workflow.id, runId }, "Workflow run started");

  const run: WorkflowRun = {
    id: runId,
    workflowId: workflow.id,
    status: "running",
    input: request.input,
    nodeResults,
    startedAt,
  };

  let order: string[];

  try {
    order = getExecutionOrder(workflow);
  } catch (error) {
    return failRun(
      run,
      "EXECUTION_ORDER_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to determine execution order",
    );
  }

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);

    if (node === undefined) {
      return failRun(
        run,
        "NODE_NOT_FOUND",
        `Workflow node "${nodeId}" was not found`,
      );
    }

    const nodeResult = await executeNode(run, node, context);
    nodeResults.push(nodeResult);

    if (nodeResult.status === "failed") {
      return failRun(
        run,
        "NODE_EXECUTION_FAILED",
        `Failed to execute node ${node.id}`,
      );
    }
  }

  run.status = "completed";
  run.output = buildWorkflowOutput(workflow, context);
  run.completedAt = new Date().toISOString();

  logger.info({ workflowId: workflow.id, runId }, "Workflow run completed");

  return run;
}

async function executeNode(
  run: WorkflowRun,
  node: WorkflowNode,
  context: ExecutionContext,
): Promise<NodeExecutionResult> {
  const startedAt = new Date().toISOString();
  const input = resolveNodeInput(node, context);

  logger.info(
    {
      workflowId: run.workflowId,
      runId: run.id,
      nodeId: node.id,
      nodeType: node.type,
    },
    "Node execution started",
  );

  try {
    const executor = getNodeExecutor(node.type);
    const output = await executor.execute(node, context);
    storeNodeOutput(context, node.id, output);

    const completedAt = new Date().toISOString();

    logger.info(
      {
        workflowId: run.workflowId,
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
      },
      "Node execution completed",
    );

    return {
      nodeId: node.id,
      nodeType: node.type,
      status: "completed",
      input,
      output,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const executionError =
      error instanceof NodeExecutionError
        ? { code: error.code, message: error.message }
        : {
            code: "NODE_EXECUTION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Node execution failed unexpectedly",
          };

    logger.warn(
      {
        workflowId: run.workflowId,
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        errorCode: executionError.code,
      },
      "Node execution failed",
    );

    return {
      nodeId: node.id,
      nodeType: node.type,
      status: "failed",
      input,
      startedAt,
      completedAt,
      error: executionError,
    };
  }
}

function resolveNodeInput(
  node: WorkflowNode,
  context: ExecutionContext,
): unknown {
  if (node.type === "trigger") {
    return { ...context.workflowInput };
  }

  return {};
}

function buildWorkflowOutput(
  workflow: Workflow,
  context: ExecutionContext,
): Record<string, unknown> {
  const terminalNodeIds = findTerminalNodeIds(workflow.nodes, workflow.edges);

  if (terminalNodeIds.length === 1) {
    const terminalNodeId = terminalNodeIds[0];

    if (terminalNodeId === undefined) {
      return {};
    }

    return asRecord(context.nodeOutputs[terminalNodeId]);
  }

  const output: Record<string, unknown> = {};

  for (const nodeId of terminalNodeIds) {
    output[nodeId] = context.nodeOutputs[nodeId];
  }

  return output;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return { value };
  }

  const record: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }

  return record;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failRun(run: WorkflowRun, code: string, message: string): WorkflowRun {
  run.status = "failed";
  run.completedAt = new Date().toISOString();
  run.error = { code, message };

  logger.warn(
    {
      workflowId: run.workflowId,
      runId: run.id,
      errorCode: code,
    },
    "Workflow run failed",
  );

  return run;
}
