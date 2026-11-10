import { describe, expect, it } from "vitest";
import { createExecutionContext } from "../src/execution/execution.context.js";
import { NodeExecutionError } from "../src/execution/execution.errors.js";
import { resolveValue } from "../src/execution/execution.resolver.js";

describe("resolveValue", () => {
  it("preserves the underlying type for an exact placeholder", () => {
    const context = createExecutionContext({ companyId: 42 });
    context.nodeOutputs["fetch-company"] = {
      body: { employeeCount: 250 },
    };

    expect(resolveValue("{{input.companyId}}", context)).toBe(42);
    expect(
      resolveValue("{{nodes.fetch-company.body.employeeCount}}", context),
    ).toBe(250);
  });

  it("interpolates placeholders inside larger strings", () => {
    const context = createExecutionContext({ companyName: "Acme" });

    expect(
      resolveValue("Company {{input.companyName}} was found", context),
    ).toBe("Company Acme was found");
  });

  it("resolves nested objects and arrays", () => {
    const context = createExecutionContext({
      companyName: "Acme",
      tags: ["enterprise"],
    });

    expect(
      resolveValue(
        {
          company: "{{input.companyName}}",
          firstTag: "{{input.tags.0}}",
          nested: { count: "{{input.tags.0}}" },
        },
        context,
      ),
    ).toEqual({
      company: "Acme",
      firstTag: "enterprise",
      nested: { count: "enterprise" },
    });
  });

  it("fails clearly when a path is missing", () => {
    const context = createExecutionContext({});

    expect(() => resolveValue("{{input.missing}}", context)).toThrow(
      NodeExecutionError,
    );

    try {
      resolveValue("{{input.missing}}", context);
    } catch (error) {
      expect(error).toMatchObject({
        code: "VALUE_RESOLUTION_FAILED",
      });
    }
  });
});
