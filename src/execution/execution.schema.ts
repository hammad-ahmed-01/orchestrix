import { z } from "zod";
import { InvalidRunRequestError } from "./execution.errors.js";

const runWorkflowSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
});

export type RunWorkflowInput = z.infer<typeof runWorkflowSchema>;

function formatIssuePath(path: readonly PropertyKey[]): string {
  let field = "";

  for (const segment of path) {
    if (typeof segment === "number") {
      field += `[${String(segment)}]`;
      continue;
    }

    if (typeof segment !== "string") {
      continue;
    }

    field = field.length === 0 ? segment : `${field}.${segment}`;
  }

  return field.length === 0 ? "(root)" : field;
}

export function parseRunWorkflowBody(body: unknown): RunWorkflowInput {
  const parsed = runWorkflowSchema.safeParse(
    body === undefined || body === null ? {} : body,
  );

  if (!parsed.success) {
    throw new InvalidRunRequestError(
      parsed.error.issues.map((issue) => ({
        field: formatIssuePath(issue.path),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}
