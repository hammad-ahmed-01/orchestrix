import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  closeDatabase,
  initDatabase,
  resetDatabase,
} from "../src/database/database.js";
import { createWorkflow } from "../src/workflows/workflow.service.js";
import { workflowStore } from "../src/workflows/workflow.store.js";
import { runWorkflow } from "../src/execution/execution.service.js";
import { runStore } from "../src/execution/run.store.js";

let baseUrl = "";
let closeServer: () => Promise<void> = async () => {};

beforeAll(async () => {
  const server = await listen(createApp());
  baseUrl = server.url;
  closeServer = server.close;
});

afterAll(async () => {
  await closeServer();
});

beforeEach(() => {
  resetDatabase();
});

describe("workflow and run persistence", () => {
  it("reconstructs workflows with nodes and edges after a new database connection", () => {
    const directory = mkdtempSync(join(tmpdir(), "orchestrix-"));
    const databasePath = join(directory, "reconnect.db");
    const created = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Persisted Workflow",
      description: "Survives reconnect",
      version: 1,
      status: "draft" as const,
      nodes: [
        { id: "start", type: "trigger" as const, name: "Start", config: {} },
        {
          id: "prepare",
          type: "action" as const,
          name: "Prepare",
          config: { operation: "set", values: { ok: true } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "prepare" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    try {
      closeDatabase();
      initDatabase(databasePath);
      workflowStore.save(created);
      closeDatabase();
      initDatabase(databasePath);

      expect(workflowStore.findById(created.id)).toEqual(created);
    } finally {
      closeDatabase();
      initDatabase(":memory:");
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates workflows transactionally", () => {
    const workflow = createWorkflow({
      name: "Atomic Create",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "step",
          type: "action",
          name: "Step",
          config: { operation: "set", values: { step: 1 } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "step" }],
    });

    expect(workflowStore.findById(workflow.id)?.nodes).toHaveLength(2);
    expect(workflowStore.findById(workflow.id)?.edges).toHaveLength(1);
  });

  it("persists completed runs with ordered node results", async () => {
    const workflow = createWorkflow({
      name: "Completed Run",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "prepare",
          type: "action",
          name: "Prepare",
          config: {
            operation: "set",
            values: { message: "done" },
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "prepare" }],
    });

    const run = await runWorkflow(workflow.id, {
      input: { requestedBy: "developer" },
    });

    const stored = runStore.findById(run.id);
    expect(stored).toMatchObject({
      status: "completed",
      input: { requestedBy: "developer" },
      output: { message: "done" },
      nodeResults: [
        { nodeId: "start", status: "completed", executionOrder: 1 },
        { nodeId: "prepare", status: "completed", executionOrder: 2 },
      ],
    });
    expect(stored?.durationMs).toBeTypeOf("number");
  });

  it("persists failed runs and node error metadata", async () => {
    const workflow = createWorkflow({
      name: "Failed Run",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "broken",
          type: "action",
          name: "Broken",
          config: { operation: "explode", values: {} },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "broken" }],
    });

    const run = await runWorkflow(workflow.id, { input: {} });
    const stored = runStore.findById(run.id);

    expect(stored).toMatchObject({
      status: "failed",
      error: {
        code: "NODE_EXECUTION_FAILED",
      },
      nodeResults: [
        { nodeId: "start", status: "completed", executionOrder: 1 },
        {
          nodeId: "broken",
          status: "failed",
          executionOrder: 2,
          error: {
            code: "UNSUPPORTED_ACTION_OPERATION",
          },
        },
      ],
    });
  });

  it("persists skipped branch state", async () => {
    const workflow = createWorkflow({
      name: "Branch Persistence",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "check",
          type: "condition",
          name: "Check",
          config: {
            left: "{{input.value}}",
            operator: "equals",
            right: "yes",
          },
        },
        {
          id: "yes",
          type: "action",
          name: "Yes",
          config: { operation: "set", values: { branch: "yes" } },
        },
        {
          id: "no",
          type: "action",
          name: "No",
          config: { operation: "set", values: { branch: "no" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "check" },
        { id: "e2", source: "check", target: "yes", condition: "true" },
        { id: "e3", source: "check", target: "no", condition: "false" },
      ],
    });

    const run = await runWorkflow(workflow.id, { input: { value: "yes" } });
    const stored = runStore.findById(run.id);

    expect(stored).toMatchObject({
      status: "completed",
      output: { branch: "yes" },
      nodeResults: [
        { nodeId: "start", status: "completed" },
        { nodeId: "check", status: "completed" },
        { nodeId: "yes", status: "completed" },
        { nodeId: "no", status: "skipped" },
      ],
    });
  });

  it("exposes run history APIs newest first", async () => {
    const workflow = createWorkflow({
      name: "History Workflow",
      nodes: [{ id: "start", type: "trigger", name: "Start", config: {} }],
      edges: [],
    });

    const first = await runWorkflow(workflow.id, { input: { n: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await runWorkflow(workflow.id, { input: { n: 2 } });

    const allRunsResponse = await fetch(`${baseUrl}/runs`);
    expect(allRunsResponse.status).toBe(200);
    const allRuns = await allRunsResponse.json();
    expect(allRuns).toEqual([
      expect.objectContaining({
        id: second.id,
        workflowId: workflow.id,
        workflowName: "History Workflow",
        status: "completed",
      }),
      expect.objectContaining({
        id: first.id,
        workflowId: workflow.id,
        workflowName: "History Workflow",
        status: "completed",
      }),
    ]);

    const workflowRunsResponse = await fetch(
      `${baseUrl}/workflows/${workflow.id}/runs`,
    );
    expect(workflowRunsResponse.status).toBe(200);
    const workflowRuns = await workflowRunsResponse.json();
    expect(workflowRuns).toEqual([
      expect.objectContaining({ id: second.id, status: "completed" }),
      expect.objectContaining({ id: first.id, status: "completed" }),
    ]);

    const detailResponse = await fetch(`${baseUrl}/runs/${second.id}`);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      id: second.id,
      workflowId: workflow.id,
      status: "completed",
      input: { n: 2 },
      output: { n: 2 },
      nodeResults: [
        {
          nodeId: "start",
          status: "completed",
          executionOrder: 1,
        },
      ],
    });
  });

  it("returns 404 for a missing run", async () => {
    const response = await fetch(
      `${baseUrl}/runs/00000000-0000-4000-8000-000000000000`,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "RUN_NOT_FOUND",
        message: "Workflow run not found",
      },
    });
  });

  it("returns only the requested workflow's runs", async () => {
    const first = createWorkflow({
      name: "First",
      nodes: [{ id: "start", type: "trigger", name: "Start", config: {} }],
      edges: [],
    });
    const second = createWorkflow({
      name: "Second",
      nodes: [{ id: "start", type: "trigger", name: "Start", config: {} }],
      edges: [],
    });

    await runWorkflow(first.id, { input: {} });
    await runWorkflow(second.id, { input: {} });

    const response = await fetch(`${baseUrl}/workflows/${first.id}/runs`);
    const runs = await response.json();

    expect(response.status).toBe(200);
    expect(runs).toHaveLength(1);
  });
});

function listen(app: ReturnType<typeof createApp>): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server: Server = app.listen(0, "127.0.0.1");

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();

      if (!isAddressInfo(address)) {
        reject(new Error("Expected the test server to listen on a TCP port."));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${String(address.port)}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });
  });
}

function isAddressInfo(
  value: AddressInfo | string | null,
): value is AddressInfo {
  return typeof value === "object" && value !== null;
}
