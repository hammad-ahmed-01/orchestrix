import { z } from "zod";
import { WorkflowValidationError } from "./workflow.errors.js";
import { workflowNodeTypes } from "./workflow.types.js";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const ID_MAX_LENGTH = 100;

function requiredName(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(
      NAME_MAX_LENGTH,
      `${label} must be at most ${String(NAME_MAX_LENGTH)} characters`,
    );
}

function requiredId(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(
      ID_MAX_LENGTH,
      `${label} must be at most ${String(ID_MAX_LENGTH)} characters`,
    );
}

const nodeSchema = z.object({
  id: requiredId("Node id"),
  type: z.enum(workflowNodeTypes, {
    error: "Node type must be trigger or action",
  }),
  name: requiredName("Node name"),
  config: z.record(z.string(), z.unknown()),
});

const edgeSchema = z.object({
  id: requiredId("Edge id"),
  source: requiredId("Edge source"),
  target: requiredId("Edge target"),
});

const createWorkflowSchema = z.object({
  name: requiredName("Workflow name"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description must be at most ${String(DESCRIPTION_MAX_LENGTH)} characters`,
    )
    .optional(),
  nodes: z.array(nodeSchema).min(1, "Workflow must contain at least one node"),
  edges: z.array(edgeSchema),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

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

export function parseCreateWorkflowBody(body: unknown): CreateWorkflowInput {
  const parsed = createWorkflowSchema.safeParse(body);

  if (!parsed.success) {
    throw new WorkflowValidationError(
      parsed.error.issues.map((issue) => ({
        field: formatIssuePath(issue.path),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}
