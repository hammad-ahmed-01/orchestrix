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

describe("workflow API", () => {
  it("creates, lists, and retrieves a valid workflow", async () => {
    const createdResponse = await postWorkflow(validWorkflow());
    expect(createdResponse.status).toBe(201);

    const created = await readJson(createdResponse);
    expect(created).toMatchObject({
      name: "Example Workflow",
      description: "Simple workflow definition",
      version: 1,
      status: "draft",
      nodes: validWorkflow().nodes,
      edges: validWorkflow().edges,
    });

    const id = readId(created);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    if (!isRecord(created)) {
      throw new Error("Expected the created workflow to be an object.");
    }

    expect(created.createdAt).toBe(created.updatedAt);
    expect(typeof created.createdAt).toBe("string");

    const listResponse = await fetch(`${baseUrl}/workflows`);
    expect(listResponse.status).toBe(200);
    const list = await readJson(listResponse);
    expect(list).toEqual([
      {
        id,
        name: "Example Workflow",
        description: "Simple workflow definition",
        status: "draft",
        version: 1,
        nodeCount: 2,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    ]);

    const fetchedResponse = await fetch(`${baseUrl}/workflows/${id}`);
    expect(fetchedResponse.status).toBe(200);
    expect(await readJson(fetchedResponse)).toEqual(created);
  });

  it("accepts a workflow that contains only a trigger", async () => {
    const response = await postWorkflow(
      validWorkflow({
        nodes: [
          {
            id: "start",
            type: "trigger",
            name: "Start",
            config: {},
          },
        ],
        edges: [],
      }),
    );

    expect(response.status).toBe(201);
    expect(await readJson(response)).toMatchObject({
      nodes: [{ id: "start", type: "trigger" }],
      edges: [],
    });
  });

  it("rejects duplicate node ids", async () => {
    await expectInvalid(
      validWorkflow({
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "start", type: "action", name: "Again", config: {} },
        ],
        edges: [],
      }),
      { field: "nodes[1].id", message: "Node id must be unique" },
    );
  });

  it("rejects duplicate edge ids", async () => {
    await expectInvalid(
      validWorkflow({
        edges: [
          { id: "edge-1", source: "start", target: "step-1" },
          { id: "edge-1", source: "start", target: "step-1" },
        ],
      }),
      { field: "edges[1].id", message: "Edge id must be unique" },
    );
  });

  it("rejects an edge that references a missing node", async () => {
    await expectInvalid(
      validWorkflow({
        edges: [{ id: "edge-1", source: "start", target: "missing" }],
      }),
      { field: "edges[0].target", message: "Target node does not exist" },
    );
  });

  it("rejects a self-referencing edge", async () => {
    await expectInvalid(
      validWorkflow({
        edges: [
          { id: "edge-1", source: "start", target: "step-1" },
          { id: "edge-2", source: "step-1", target: "step-1" },
        ],
      }),
      {
        field: "edges[1].target",
        message: "Edges cannot connect a node to itself",
      },
    );
  });

  it("rejects multiple trigger nodes", async () => {
    await expectInvalid(
      validWorkflow({
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "again", type: "trigger", name: "Again", config: {} },
        ],
        edges: [],
      }),
      {
        field: "nodes",
        message: "Workflow must contain exactly one trigger node",
      },
    );
  });

  it("rejects a workflow with no trigger node", async () => {
    await expectInvalid(
      validWorkflow({
        nodes: [
          { id: "step-1", type: "action", name: "Process Data", config: {} },
        ],
        edges: [],
      }),
      {
        field: "nodes",
        message: "Workflow must contain exactly one trigger node",
      },
    );
  });

  it("rejects a trigger with an incoming edge", async () => {
    await expectInvalid(
      validWorkflow({
        edges: [{ id: "edge-1", source: "step-1", target: "start" }],
      }),
      {
        field: "edges[0].target",
        message: "Trigger node cannot have incoming edges",
      },
    );
  });

  it("rejects a cyclic graph", async () => {
    await expectInvalid(
      validWorkflow({
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "b", type: "action", name: "B", config: {} },
          { id: "c", type: "action", name: "C", config: {} },
        ],
        edges: [
          { id: "edge-1", source: "start", target: "b" },
          { id: "edge-2", source: "b", target: "c" },
          { id: "edge-3", source: "c", target: "start" },
        ],
      }),
      { field: "edges", message: "Workflow contains a cycle" },
    );
  });

  it("rejects an unsupported node type", async () => {
    const response = await postWorkflow(
      validWorkflow({
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "step-1", type: "llm", name: "Ask", config: {} },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const payload = await readJson(response);
    expect(payload).toMatchObject({
      error: {
        code: "INVALID_WORKFLOW",
        message: "Workflow definition is invalid",
      },
    });

    if (
      !isRecord(payload) ||
      !isRecord(payload.error) ||
      !Array.isArray(payload.error.details)
    ) {
      throw new Error("Expected workflow validation details.");
    }

    expect(payload.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "nodes[1].type",
        }),
      ]),
    );
  });

  it("rejects condition labels on non-condition edges", async () => {
    await expectInvalid(
      validWorkflow({
        edges: [
          {
            id: "edge-1",
            source: "start",
            target: "step-1",
            condition: "true",
          },
        ],
      }),
      {
        field: "edges[0].condition",
        message:
          "Condition labels are only allowed on edges from condition nodes",
      },
    );
  });

  it("rejects duplicate true branch edges", async () => {
    await expectInvalid(
      {
        name: "Duplicate True Branch",
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          {
            id: "check",
            type: "condition",
            name: "Check",
            config: { left: 1, operator: "equals", right: 1 },
          },
          {
            id: "yes-a",
            type: "action",
            name: "Yes A",
            config: { operation: "set", values: { branch: "a" } },
          },
          {
            id: "yes-b",
            type: "action",
            name: "Yes B",
            config: { operation: "set", values: { branch: "b" } },
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
          {
            id: "e2",
            source: "check",
            target: "yes-a",
            condition: "true",
          },
          {
            id: "e3",
            source: "check",
            target: "yes-b",
            condition: "true",
          },
          {
            id: "e4",
            source: "check",
            target: "no",
            condition: "false",
          },
        ],
      },
      {
        field: "edges[2].condition",
        message: 'Condition node "check" has duplicate true branches',
      },
    );
  });

  it("rejects an invalid HTTP URL", async () => {
    const response = await postWorkflow({
      name: "Invalid HTTP URL",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "fetch",
          type: "http",
          name: "Fetch",
          config: {
            method: "GET",
            url: "ftp://example.com/resource",
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "fetch" }],
    });

    expect(response.status).toBe(400);
    const payload = await readJson(response);
    expect(payload).toMatchObject({
      error: {
        code: "INVALID_WORKFLOW",
      },
    });

    if (
      !isRecord(payload) ||
      !isRecord(payload.error) ||
      !Array.isArray(payload.error.details)
    ) {
      throw new Error("Expected workflow validation details.");
    }

    expect(payload.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "nodes[1].config.url",
        }),
      ]),
    );
  });

  it("returns 404 when a workflow does not exist", async () => {
    const response = await fetch(
      `${baseUrl}/workflows/00000000-0000-4000-8000-000000000000`,
    );
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({
      error: {
        code: "WORKFLOW_NOT_FOUND",
        message: "Workflow not found",
      },
    });
  });
});

function validWorkflow(
  overrides: Partial<{
    name: string;
    description: string;
    nodes: unknown;
    edges: unknown;
  }> = {},
) {
  return {
    name: "Example Workflow",
    description: "Simple workflow definition",
    nodes: [
      { id: "start", type: "trigger", name: "Start", config: {} },
      { id: "step-1", type: "action", name: "Process Data", config: {} },
    ],
    edges: [{ id: "edge-1", source: "start", target: "step-1" }],
    ...overrides,
  };
}

async function postWorkflow(body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/workflows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectInvalid(
  body: unknown,
  issue: { field: string; message: string },
): Promise<void> {
  const response = await postWorkflow(body);
  expect(response.status).toBe(400);

  const error = readError(await readJson(response));
  expect(error).toMatchObject({
    code: "INVALID_WORKFLOW",
    message: "Workflow definition is invalid",
  });
  expect(error.details).toContainEqual(issue);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function readError(payload: unknown): {
  code: string;
  message: string;
  details: { field: string; message: string }[];
} {
  if (
    !isRecord(payload) ||
    !isRecord(payload.error) ||
    !Array.isArray(payload.error.details)
  ) {
    throw new Error("Expected a workflow validation error.");
  }

  const { code, message, details } = payload.error;

  if (typeof code !== "string" || typeof message !== "string") {
    throw new Error("Expected a workflow validation error.");
  }

  return {
    code,
    message,
    details: details.map((detail) => {
      if (
        !isRecord(detail) ||
        typeof detail.field !== "string" ||
        typeof detail.message !== "string"
      ) {
        throw new Error("Expected workflow validation details.");
      }

      return { field: detail.field, message: detail.message };
    }),
  };
}

function readId(value: unknown): string {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Expected the workflow response to include an id.");
  }

  return value.id;
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
