import { randomUUID } from "node:crypto";
import { getDb } from "../database/database.js";
import { calculateDurationMs } from "../database/duration.js";
import {
  fromJsonText,
  fromNullableJsonText,
  toJsonText,
  toNullableJsonText,
} from "../database/json.js";
import { logger } from "../config/logger.js";
import { PersistenceError } from "./run.errors.js";
import type {
  NodeExecutionResult,
  NodeExecutionStatus,
  WorkflowRun,
  WorkflowRunStatus,
} from "./execution.types.js";

export type WorkflowRunSummary = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
};

export type WorkflowRunDetail = WorkflowRun & {
  durationMs?: number;
  nodeResults: NodeExecutionResultDetail[];
};

export type NodeExecutionResultDetail = NodeExecutionResult & {
  durationMs?: number;
};

type RunRow = {
  id: string;
  workflow_id: string;
  status: string;
  input_json: string;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  workflow_name?: string;
};

type NodeResultRow = {
  id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  status: string;
  input_json: string;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string;
  execution_order: number;
};

export const runStore = {
  createRunningRun(run: WorkflowRun): void {
    try {
      getDb()
        .prepare(
          `
            INSERT INTO workflow_runs (
              id, workflow_id, status, input_json, output_json,
              error_code, error_message, started_at, completed_at
            ) VALUES (
              @id, @workflow_id, @status, @input_json, @output_json,
              @error_code, @error_message, @started_at, @completed_at
            )
          `,
        )
        .run({
          id: run.id,
          workflow_id: run.workflowId,
          status: "running",
          input_json: toJsonText(run.input),
          output_json: null,
          error_code: null,
          error_message: null,
          started_at: run.startedAt,
          completed_at: null,
        });
    } catch (error) {
      throw new PersistenceError("Failed to create workflow run", error);
    }
  },

  saveNodeResult(
    runId: string,
    result: NodeExecutionResult,
    executionOrder: number,
  ): void {
    try {
      getDb()
        .prepare(
          `
            INSERT INTO node_execution_results (
              id, run_id, node_id, node_type, status, input_json, output_json,
              error_code, error_message, started_at, completed_at, execution_order
            ) VALUES (
              @id, @run_id, @node_id, @node_type, @status, @input_json, @output_json,
              @error_code, @error_message, @started_at, @completed_at, @execution_order
            )
          `,
        )
        .run({
          id: randomUUID(),
          run_id: runId,
          node_id: result.nodeId,
          node_type: result.nodeType,
          status: result.status,
          input_json: toJsonText(result.input),
          output_json: toNullableJsonText(result.output),
          error_code: result.error?.code ?? null,
          error_message: result.error?.message ?? null,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          execution_order: executionOrder,
        });
    } catch (error) {
      throw new PersistenceError(
        `Failed to persist node result for "${result.nodeId}"`,
        error,
      );
    }
  },

  completeRun(run: WorkflowRun): void {
    try {
      getDb()
        .prepare(
          `
            UPDATE workflow_runs
            SET
              status = @status,
              output_json = @output_json,
              error_code = @error_code,
              error_message = @error_message,
              completed_at = @completed_at
            WHERE id = @id
          `,
        )
        .run({
          id: run.id,
          status: run.status,
          output_json: toNullableJsonText(run.output),
          error_code: run.error?.code ?? null,
          error_message: run.error?.message ?? null,
          completed_at: run.completedAt ?? null,
        });
    } catch (error) {
      throw new PersistenceError("Failed to update workflow run", error);
    }
  },

  listRuns(): WorkflowRunSummary[] {
    const rows = getDb()
      .prepare(
        `
          SELECT
            r.id,
            r.workflow_id,
            r.status,
            r.input_json,
            r.output_json,
            r.error_code,
            r.error_message,
            r.started_at,
            r.completed_at,
            w.name AS workflow_name
          FROM workflow_runs r
          INNER JOIN workflows w ON w.id = r.workflow_id
          ORDER BY r.started_at DESC, r.id DESC
        `,
      )
      .all() as RunRow[];

    return rows.map((row) => mapRunSummary(row));
  },

  listRunsByWorkflowId(workflowId: string): WorkflowRunSummary[] {
    const rows = getDb()
      .prepare(
        `
          SELECT
            r.id,
            r.workflow_id,
            r.status,
            r.input_json,
            r.output_json,
            r.error_code,
            r.error_message,
            r.started_at,
            r.completed_at,
            w.name AS workflow_name
          FROM workflow_runs r
          INNER JOIN workflows w ON w.id = r.workflow_id
          WHERE r.workflow_id = ?
          ORDER BY r.started_at DESC, r.id DESC
        `,
      )
      .all(workflowId) as RunRow[];

    return rows.map((row) => mapRunSummary(row));
  },

  findById(id: string): WorkflowRunDetail | undefined {
    const row = getDb()
      .prepare(
        `
          SELECT
            id, workflow_id, status, input_json, output_json,
            error_code, error_message, started_at, completed_at
          FROM workflow_runs
          WHERE id = ?
        `,
      )
      .get(id) as RunRow | undefined;

    if (row === undefined) {
      return undefined;
    }

    const nodeRows = getDb()
      .prepare(
        `
          SELECT
            id, run_id, node_id, node_type, status, input_json, output_json,
            error_code, error_message, started_at, completed_at, execution_order
          FROM node_execution_results
          WHERE run_id = ?
          ORDER BY execution_order ASC
        `,
      )
      .all(id) as NodeResultRow[];

    return mapRunDetail(row, nodeRows);
  },

  countRunningRuns(): number {
    const row = getDb()
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM workflow_runs
          WHERE status = 'running'
        `,
      )
      .get() as { count: number };

    return row.count;
  },
};

export function warnAboutStaleRunningRuns(): void {
  const count = runStore.countRunningRuns();

  if (count > 0) {
    logger.warn(
      { count },
      "Found incomplete workflow runs from a previous process",
    );
  }
}

function mapRunSummary(row: RunRow): WorkflowRunSummary {
  const completedAt = row.completed_at ?? undefined;
  const summary: WorkflowRunSummary = {
    id: row.id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name ?? "",
    status: parseRunStatus(row.status),
    startedAt: row.started_at,
  };

  if (completedAt !== undefined) {
    summary.completedAt = completedAt;
  }

  const durationMs = calculateDurationMs(row.started_at, completedAt);

  if (durationMs !== undefined) {
    summary.durationMs = durationMs;
  }

  return summary;
}

function mapRunDetail(
  row: RunRow,
  nodeRows: NodeResultRow[],
): WorkflowRunDetail {
  const completedAt = row.completed_at ?? undefined;
  const input = fromJsonText(row.input_json);
  const output = fromNullableJsonText(row.output_json);

  if (!isPlainObject(input)) {
    throw new Error(`Invalid input for run "${row.id}"`);
  }

  const detail: WorkflowRunDetail = {
    id: row.id,
    workflowId: row.workflow_id,
    status: parseRunStatus(row.status),
    input,
    nodeResults: nodeRows.map(mapNodeResult),
    startedAt: row.started_at,
  };

  if (isPlainObject(output)) {
    detail.output = output;
  }

  if (completedAt !== undefined) {
    detail.completedAt = completedAt;
  }

  if (row.error_code !== null && row.error_message !== null) {
    detail.error = {
      code: row.error_code,
      message: row.error_message,
    };
  }

  const durationMs = calculateDurationMs(row.started_at, completedAt);

  if (durationMs !== undefined) {
    detail.durationMs = durationMs;
  }

  return detail;
}

function mapNodeResult(row: NodeResultRow): NodeExecutionResultDetail {
  const result: NodeExecutionResultDetail = {
    nodeId: row.node_id,
    nodeType: row.node_type,
    status: parseNodeStatus(row.status),
    input: fromJsonText(row.input_json),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    executionOrder: row.execution_order,
  };

  const output = fromNullableJsonText(row.output_json);

  if (output !== undefined) {
    result.output = output;
  }

  if (row.error_code !== null && row.error_message !== null) {
    result.error = {
      code: row.error_code,
      message: row.error_message,
    };
  }

  const durationMs = calculateDurationMs(row.started_at, row.completed_at);

  if (durationMs !== undefined) {
    result.durationMs = durationMs;
  }

  return result;
}

function parseRunStatus(value: string): WorkflowRunStatus {
  if (value === "running" || value === "completed" || value === "failed") {
    return value;
  }

  throw new Error(`Invalid run status "${value}"`);
}

function parseNodeStatus(value: string): NodeExecutionStatus {
  if (value === "completed" || value === "failed" || value === "skipped") {
    return value;
  }

  throw new Error(`Invalid node execution status "${value}"`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
