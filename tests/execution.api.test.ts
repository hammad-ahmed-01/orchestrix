import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { workflowStore } from "../src/workflows/workflow.store.js";

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
  workflowStore.clear();
});

describe("workflow execution API", () => {
  it("executes a single trigger workflow and returns the input as output", async () => {
    const workflowId = await createWorkflow({
      name: "Trigger Only",
      nodes: [{ id: "start", type: "trigger", name: "Start", config: {} }],
      edges: [],
    });

    const run = await runWorkflow(workflowId, {
      input: { requestedBy: "developer" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      workflowId,
      status: "completed",
      input: { requestedBy: "developer" },
      output: { requestedBy: "developer" },
      nodeResults: [
        {
          nodeId: "start",
          nodeType: "trigger",
          status: "completed",
          input: { requestedBy: "developer" },
          output: { requestedBy: "developer" },
        },
      ],
    });
  });

  it("executes trigger then action and uses the final node as workflow output", async () => {
    const workflowId = await createWorkflow({
      name: "First Executable Workflow",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "prepare",
          type: "action",
          name: "Prepare Result",
          config: {
            operation: "set",
            values: {
              success: true,
              message: "Hello from Orchestrix",
            },
          },
        },
      ],
      edges: [{ id: "start-to-prepare", source: "start", target: "prepare" }],
    });

    const run = await runWorkflow(workflowId, {
      input: { requestedBy: "developer" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      input: { requestedBy: "developer" },
      output: {
        success: true,
        message: "Hello from Orchestrix",
      },
      nodeResults: [
        {
          nodeId: "start",
          nodeType: "trigger",
          status: "completed",
          output: { requestedBy: "developer" },
        },
        {
          nodeId: "prepare",
          nodeType: "action",
          status: "completed",
          input: {},
          output: {
            success: true,
            message: "Hello from Orchestrix",
          },
        },
      ],
    });
  });

  it("executes multiple sequential actions in dependency order", async () => {
    const workflowId = await createWorkflow({
      name: "Sequential Actions",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "first",
          type: "action",
          name: "First",
          config: { operation: "set", values: { step: 1 } },
        },
        {
          id: "second",
          type: "action",
          name: "Second",
          config: { operation: "set", values: { step: 2 } },
        },
      ],
      edges: [
        { id: "start-first", source: "start", target: "first" },
        { id: "first-second", source: "first", target: "second" },
      ],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(readNodeIds(run.body)).toEqual(["start", "first", "second"]);
    expect(run.body).toMatchObject({
      status: "completed",
      output: { step: 2 },
    });
  });

  it("ignores node array order when determining execution order", async () => {
    const workflowId = await createWorkflow({
      name: "Shuffled Nodes",
      nodes: [
        {
          id: "c",
          type: "action",
          name: "C",
          config: { operation: "set", values: { node: "c" } },
        },
        { id: "a", type: "trigger", name: "A", config: {} },
        {
          id: "b",
          type: "action",
          name: "B",
          config: { operation: "set", values: { node: "b" } },
        },
      ],
      edges: [
        { id: "a-b", source: "a", target: "b" },
        { id: "b-c", source: "b", target: "c" },
      ],
    });

    const run = await runWorkflow(workflowId, {
      input: { seed: true },
    });

    expect(run.status).toBe(200);
    expect(readNodeIds(run.body)).toEqual(["a", "b", "c"]);
    expect(run.body).toMatchObject({
      status: "completed",
      output: { node: "c" },
    });
  });

  it("stores each node output in the execution context", async () => {
    const workflowId = await createWorkflow({
      name: "Context Check",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "prepare",
          type: "action",
          name: "Prepare",
          config: {
            operation: "set",
            values: { processed: true, source: "orchestrix" },
          },
        },
      ],
      edges: [{ id: "edge-1", source: "start", target: "prepare" }],
    });

    const run = await runWorkflow(workflowId, {
      input: { customer: "Acme" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      nodeResults: [
        {
          nodeId: "start",
          output: { customer: "Acme" },
        },
        {
          nodeId: "prepare",
          output: { processed: true, source: "orchestrix" },
        },
      ],
      output: { processed: true, source: "orchestrix" },
    });
  });

  it("returns keyed output when a workflow ends in multiple terminals", async () => {
    const workflowId = await createWorkflow({
      name: "Fork",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "branch-b",
          type: "action",
          name: "B",
          config: { operation: "set", values: { branch: "b" } },
        },
        {
          id: "branch-a",
          type: "action",
          name: "A",
          config: { operation: "set", values: { branch: "a" } },
        },
      ],
      edges: [
        { id: "start-b", source: "start", target: "branch-b" },
        { id: "start-a", source: "start", target: "branch-a" },
      ],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(readNodeIds(run.body)).toEqual(["start", "branch-a", "branch-b"]);
    expect(run.body).toMatchObject({
      status: "completed",
      output: {
        "branch-a": { branch: "a" },
        "branch-b": { branch: "b" },
      },
    });
  });

  it("fails the run for an unsupported action operation", async () => {
    const workflowId = await createWorkflow({
      name: "Unsupported Action",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "prepare-result",
          type: "action",
          name: "Prepare Result",
          config: { operation: "transform", values: { ok: true } },
        },
      ],
      edges: [{ id: "edge-1", source: "start", target: "prepare-result" }],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "failed",
      error: {
        code: "NODE_EXECUTION_FAILED",
        message: "Failed to execute node prepare-result",
      },
      nodeResults: [
        {
          nodeId: "start",
          status: "completed",
        },
        {
          nodeId: "prepare-result",
          status: "failed",
          error: {
            code: "UNSUPPORTED_ACTION_OPERATION",
            message: 'Unsupported action operation "transform"',
          },
        },
      ],
    });
    expect(isRecord(run.body) ? run.body.output : undefined).toBeUndefined();
  });

  it("returns 404 when the workflow does not exist", async () => {
    const response = await fetch(
      `${baseUrl}/workflows/00000000-0000-4000-8000-000000000000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: {} }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "WORKFLOW_NOT_FOUND",
        message: "Workflow not found",
      },
    });
  });

  it("defaults missing input to an empty object", async () => {
    const workflowId = await createWorkflow({
      name: "Default Input",
      nodes: [{ id: "start", type: "trigger", name: "Start", config: {} }],
      edges: [],
    });

    const response = await fetch(`${baseUrl}/workflows/${workflowId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "completed",
      input: {},
      output: {},
    });
  });
});

async function createWorkflow(body: unknown): Promise<string> {
  const response = await fetch(`${baseUrl}/workflows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  expect(response.status).toBe(201);
  const payload: unknown = await response.json();

  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new Error("Expected a created workflow id.");
  }

  return payload.id;
}

async function runWorkflow(
  workflowId: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/workflows/${workflowId}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function readNodeIds(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.nodeResults)) {
    throw new Error("Expected nodeResults on the run response.");
  }

  return body.nodeResults.map((result) => {
    if (!isRecord(result) || typeof result.nodeId !== "string") {
      throw new Error("Expected each node result to include a nodeId.");
    }

    return result.nodeId;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
