import { describe, expect, it } from "vitest";
import { hasCycle } from "../src/workflows/workflow.graph.js";

describe("hasCycle", () => {
  it("returns false for a linear graph", () => {
    expect(
      hasCycle(
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
        ],
      ),
    ).toBe(false);
  });

  it("returns false for a branch that joins again", () => {
    expect(
      hasCycle(
        [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
        [
          { source: "a", target: "b" },
          { source: "a", target: "c" },
          { source: "b", target: "d" },
          { source: "c", target: "d" },
        ],
      ),
    ).toBe(false);
  });

  it("returns true when a path loops back", () => {
    expect(
      hasCycle(
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "c", target: "a" },
        ],
      ),
    ).toBe(true);
  });

  it("returns true for a self-loop", () => {
    expect(hasCycle([{ id: "a" }], [{ source: "a", target: "a" }])).toBe(true);
  });
});
