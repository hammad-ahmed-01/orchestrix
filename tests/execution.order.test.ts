import { describe, expect, it } from "vitest";
import {
  findTerminalNodeIds,
  getExecutionOrder,
} from "../src/execution/execution.order.js";
import type { Workflow } from "../src/workflows/workflow.types.js";

describe("getExecutionOrder", () => {
  it("follows graph dependencies instead of the node array order", () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: "c", type: "action", name: "C", config: {} },
        { id: "a", type: "trigger", name: "A", config: {} },
        { id: "b", type: "action", name: "B", config: {} },
      ],
      edges: [
        { id: "a-b", source: "a", target: "b" },
        { id: "b-c", source: "b", target: "c" },
      ],
    });

    expect(getExecutionOrder(workflow)).toEqual(["a", "b", "c"]);
  });

  it("executes independent ready nodes in deterministic id order", () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        { id: "branch-b", type: "action", name: "B", config: {} },
        { id: "branch-a", type: "action", name: "A", config: {} },
      ],
      edges: [
        { id: "start-b", source: "start", target: "branch-b" },
        { id: "start-a", source: "start", target: "branch-a" },
      ],
    });

    expect(getExecutionOrder(workflow)).toEqual([
      "start",
      "branch-a",
      "branch-b",
    ]);
  });

  it("waits until every dependency has completed", () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: "start", type: "trigger", name: "Start", config: {} },
        { id: "left", type: "action", name: "Left", config: {} },
        { id: "right", type: "action", name: "Right", config: {} },
        { id: "join", type: "action", name: "Join", config: {} },
      ],
      edges: [
        { id: "start-left", source: "start", target: "left" },
        { id: "start-right", source: "start", target: "right" },
        { id: "left-join", source: "left", target: "join" },
        { id: "right-join", source: "right", target: "join" },
      ],
    });

    const order = getExecutionOrder(workflow);
    expect(order.indexOf("start")).toBeLessThan(order.indexOf("left"));
    expect(order.indexOf("start")).toBeLessThan(order.indexOf("right"));
    expect(order.indexOf("left")).toBeLessThan(order.indexOf("join"));
    expect(order.indexOf("right")).toBeLessThan(order.indexOf("join"));
    expect(order).toEqual(["start", "left", "right", "join"]);
  });
});

describe("findTerminalNodeIds", () => {
  it("returns every node without outgoing edges", () => {
    expect(
      findTerminalNodeIds(
        [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "left", type: "action", name: "Left", config: {} },
          { id: "right", type: "action", name: "Right", config: {} },
        ],
        [
          { id: "start-left", source: "start", target: "left" },
          { id: "start-right", source: "start", target: "right" },
        ],
      ),
    ).toEqual(["left", "right"]);
  });
});

function makeWorkflow(overrides: Pick<Workflow, "nodes" | "edges">): Workflow {
  return {
    id: "workflow-1",
    name: "Order Test",
    version: 1,
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
