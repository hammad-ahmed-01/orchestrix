import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { workflowStore } from "../src/workflows/workflow.store.js";

let appBaseUrl = "";
let closeApp: () => Promise<void> = async () => {};
let testApiBaseUrl = "";
let closeTestApi: () => Promise<void> = async () => {};

beforeAll(async () => {
  const appServer = await listen(createApp());
  appBaseUrl = appServer.url;
  closeApp = appServer.close;

  const testApi = await listenTestApi();
  testApiBaseUrl = testApi.url;
  closeTestApi = testApi.close;
});

afterAll(async () => {
  await closeApp();
  await closeTestApi();
});

beforeEach(() => {
  workflowStore.clear();
});

describe("HTTP and conditional execution", () => {
  it("executes an HTTP GET node successfully", async () => {
    const workflowId = await createWorkflow({
      name: "HTTP GET",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "fetch-company",
          type: "http",
          name: "Fetch Company",
          config: {
            method: "GET",
            url: `${testApiBaseUrl}/company/acme`,
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "fetch-company" }],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      output: {
        status: 200,
        body: {
          id: "acme",
          name: "Acme",
          employeeCount: 250,
        },
      },
    });
  });

  it("sends a resolved HTTP POST body and headers", async () => {
    const workflowId = await createWorkflow({
      name: "HTTP POST",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "create-company",
          type: "http",
          name: "Create Company",
          config: {
            method: "POST",
            url: `${testApiBaseUrl}/echo`,
            headers: {
              "X-Company": "{{input.companyName}}",
            },
            body: {
              company: "{{input.companyName}}",
              requestId: "{{input.requestId}}",
            },
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "create-company" }],
    });

    const run = await runWorkflow(workflowId, {
      input: {
        companyName: "Acme",
        requestId: "req-123",
      },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      output: {
        status: 200,
        body: {
          method: "POST",
          headers: {
            "x-company": "Acme",
          },
          body: {
            company: "Acme",
            requestId: "req-123",
          },
        },
      },
    });
  });

  it("resolves workflow input into an HTTP URL", async () => {
    const workflowId = await createWorkflow({
      name: "HTTP URL Template",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "fetch-company",
          type: "http",
          name: "Fetch Company",
          config: {
            method: "GET",
            url: `${testApiBaseUrl}/company/{{input.companyId}}`,
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "fetch-company" }],
    });

    const run = await runWorkflow(workflowId, {
      input: { companyId: "acme" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      output: {
        body: {
          id: "acme",
          employeeCount: 250,
        },
      },
    });
  });

  it("fails the node when an HTTP request times out", async () => {
    const workflowId = await createWorkflow({
      name: "HTTP Timeout",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "slow",
          type: "http",
          name: "Slow",
          config: {
            method: "GET",
            url: `${testApiBaseUrl}/slow`,
            timeoutMs: 100,
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "slow" }],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "failed",
      error: {
        code: "NODE_EXECUTION_FAILED",
      },
      nodeResults: [
        { nodeId: "start", status: "completed" },
        {
          nodeId: "slow",
          status: "failed",
          error: {
            code: "HTTP_REQUEST_TIMEOUT",
          },
        },
      ],
    });
  });

  it("fails the node for a non-2xx HTTP response", async () => {
    const workflowId = await createWorkflow({
      name: "HTTP Error",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "missing",
          type: "http",
          name: "Missing",
          config: {
            method: "GET",
            url: `${testApiBaseUrl}/missing`,
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "missing" }],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "failed",
      nodeResults: [
        { nodeId: "start", status: "completed" },
        {
          nodeId: "missing",
          status: "failed",
          error: {
            code: "HTTP_RESPONSE_ERROR",
          },
        },
      ],
    });
  });

  it("evaluates equals, numeric comparison, contains, and exists", async () => {
    const equalsId = await createWorkflow(
      conditionWorkflow("equals", "{{input.value}}", "acme"),
    );
    const greaterId = await createWorkflow(
      conditionWorkflow("greater_than", "{{input.count}}", 100),
    );
    const containsId = await createWorkflow(
      conditionWorkflow("contains", "{{input.label}}", "prise"),
    );
    const existsId = await createWorkflow({
      name: "Exists",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "check",
          type: "condition",
          name: "Check",
          config: {
            left: "{{input.optional}}",
            operator: "exists",
          },
        },
        actionNode("yes", "yes"),
        actionNode("no", "no"),
      ],
      edges: branchEdges(),
    });

    expect(await runCondition(equalsId, { value: "acme" })).toBe(true);
    expect(await runCondition(greaterId, { count: 250 })).toBe(true);
    expect(await runCondition(containsId, { label: "enterprise" })).toBe(true);
    expect(await runCondition(existsId, { optional: "present" })).toBe(true);
    expect(await runCondition(existsId, {})).toBe(false);
  });

  it("executes only the true branch and skips the false branch", async () => {
    const workflowId = await createClassificationWorkflow();

    const run = await runWorkflow(workflowId, {
      input: { companyId: "acme" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      output: { segment: "enterprise" },
      nodeResults: [
        { nodeId: "start", status: "completed" },
        { nodeId: "fetch-company", status: "completed" },
        {
          nodeId: "check-size",
          status: "completed",
          output: { result: true },
        },
        { nodeId: "enterprise", status: "completed" },
        { nodeId: "smb", status: "skipped" },
      ],
    });
  });

  it("executes only the false branch and skips the true branch", async () => {
    const workflowId = await createClassificationWorkflow();

    const run = await runWorkflow(workflowId, {
      input: { companyId: "small" },
    });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "completed",
      output: { segment: "smb" },
      nodeResults: [
        { nodeId: "start", status: "completed" },
        { nodeId: "fetch-company", status: "completed" },
        {
          nodeId: "check-size",
          status: "completed",
          output: { result: false },
        },
        { nodeId: "smb", status: "completed" },
        { nodeId: "enterprise", status: "skipped" },
      ],
    });
  });

  it("fails clearly when a template value is missing", async () => {
    const workflowId = await createWorkflow({
      name: "Missing Template",
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "prepare",
          type: "action",
          name: "Prepare",
          config: {
            operation: "set",
            values: {
              company: "{{input.missing}}",
            },
          },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "prepare" }],
    });

    const run = await runWorkflow(workflowId, { input: {} });

    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({
      status: "failed",
      nodeResults: [
        { nodeId: "start", status: "completed" },
        {
          nodeId: "prepare",
          status: "failed",
          error: {
            code: "VALUE_RESOLUTION_FAILED",
          },
        },
      ],
    });
  });

  it("still follows graph dependencies with HTTP and conditions", async () => {
    const workflowId = await createWorkflow({
      name: "Dependency Order",
      nodes: [
        {
          id: "prepare",
          type: "action",
          name: "Prepare",
          config: {
            operation: "set",
            values: { ready: true },
          },
        },
        { id: "start", type: "trigger", name: "Start", config: {} },
        {
          id: "fetch-company",
          type: "http",
          name: "Fetch",
          config: {
            method: "GET",
            url: `${testApiBaseUrl}/company/{{input.companyId}}`,
          },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "fetch-company" },
        { id: "e2", source: "fetch-company", target: "prepare" },
      ],
    });

    const run = await runWorkflow(workflowId, {
      input: { companyId: "acme" },
    });

    expect(run.status).toBe(200);
    expect(readNodeIds(run.body)).toEqual([
      "start",
      "fetch-company",
      "prepare",
    ]);
  });
});

function conditionWorkflow(
  operator: string,
  left: unknown,
  right: unknown,
): unknown {
  return {
    name: `Condition ${operator}`,
    nodes: [
      { id: "start", type: "trigger", name: "Start", config: {} },
      {
        id: "check",
        type: "condition",
        name: "Check",
        config: { left, operator, right },
      },
      actionNode("yes", "yes"),
      actionNode("no", "no"),
    ],
    edges: branchEdges(),
  };
}

function actionNode(id: string, segment: string) {
  return {
    id,
    type: "action",
    name: id,
    config: {
      operation: "set",
      values: { segment },
    },
  };
}

function branchEdges() {
  return [
    { id: "e1", source: "start", target: "check" },
    { id: "e2", source: "check", target: "yes", condition: "true" },
    { id: "e3", source: "check", target: "no", condition: "false" },
  ];
}

async function createClassificationWorkflow(): Promise<string> {
  return createWorkflow({
    name: "Company Classification",
    nodes: [
      { id: "start", type: "trigger", name: "Start", config: {} },
      {
        id: "fetch-company",
        type: "http",
        name: "Fetch Company",
        config: {
          method: "GET",
          url: `${testApiBaseUrl}/company/{{input.companyId}}`,
        },
      },
      {
        id: "check-size",
        type: "condition",
        name: "Check Size",
        config: {
          left: "{{nodes.fetch-company.body.employeeCount}}",
          operator: "greater_than",
          right: 100,
        },
      },
      {
        id: "enterprise",
        type: "action",
        name: "Enterprise",
        config: {
          operation: "set",
          values: {
            segment: "enterprise",
            companyName: "{{nodes.fetch-company.body.name}}",
          },
        },
      },
      {
        id: "smb",
        type: "action",
        name: "SMB",
        config: {
          operation: "set",
          values: {
            segment: "smb",
            companyName: "{{nodes.fetch-company.body.name}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "fetch-company" },
      { id: "e2", source: "fetch-company", target: "check-size" },
      {
        id: "e3",
        source: "check-size",
        target: "enterprise",
        condition: "true",
      },
      {
        id: "e4",
        source: "check-size",
        target: "smb",
        condition: "false",
      },
    ],
  });
}

async function runCondition(
  workflowId: string,
  input: Record<string, unknown>,
): Promise<boolean> {
  const run = await runWorkflow(workflowId, { input });
  expect(run.status).toBe(200);

  if (!isRecord(run.body) || !Array.isArray(run.body.nodeResults)) {
    throw new Error("Expected node results.");
  }

  let conditionResult: boolean | undefined;

  for (const result of run.body.nodeResults) {
    if (!isRecord(result) || result.nodeId !== "check") {
      continue;
    }

    if (!isRecord(result.output) || typeof result.output.result !== "boolean") {
      throw new Error("Expected condition result.");
    }

    conditionResult = result.output.result;
    break;
  }

  if (conditionResult === undefined) {
    throw new Error("Expected condition result.");
  }

  return conditionResult;
}

async function createWorkflow(body: unknown): Promise<string> {
  const response = await fetch(`${appBaseUrl}/workflows`, {
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
  const response = await fetch(`${appBaseUrl}/workflows/${workflowId}/run`, {
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

function listenTestApi(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    void handleTestApiRequest(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!isAddressInfo(address)) {
        reject(new Error("Expected the test API to listen on a TCP port."));
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

async function handleTestApiRequest(
  req: IncomingMessage,
  res: import("node:http").ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (url.pathname === "/slow") {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    }, 1000);
    return;
  }

  if (url.pathname === "/missing") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "missing" }));
    return;
  }

  if (url.pathname.startsWith("/company/")) {
    const companyId = url.pathname.slice("/company/".length);
    const employeeCount = companyId === "small" ? 12 : 250;
    const name = companyId === "small" ? "Small Co" : "Acme";

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: companyId,
        name,
        employeeCount,
      }),
    );
    return;
  }

  if (url.pathname === "/echo") {
    const chunks: Uint8Array[] = [];

    for await (const chunk of req) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk),
      );
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    let body: unknown;

    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        body = rawBody;
      }
    } else {
      body = null;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        method: req.method,
        headers: {
          "x-company": headers["x-company"],
        },
        body,
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}

function isAddressInfo(
  value: AddressInfo | string | null,
): value is AddressInfo {
  return typeof value === "object" && value !== null;
}
