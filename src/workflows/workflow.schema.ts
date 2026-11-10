import { z } from "zod";
import { WorkflowValidationError } from "./workflow.errors.js";
import {
  conditionOperators,
  edgeConditions,
  httpMethods,
} from "./workflow.types.js";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const ID_MAX_LENGTH = 100;
const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

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

function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateHttpUrlTemplate(url: string, ctx: z.RefinementCtx): void {
  if (url.includes("{{")) {
    const exactPlaceholder = /^\{\{[^{}]+\}\}$/.test(url.trim());
    const hasHttpPrefix =
      url.startsWith("http://") || url.startsWith("https://");

    if (!exactPlaceholder && !hasHttpPrefix) {
      ctx.addIssue({
        code: "custom",
        message:
          "HTTP URL templates must start with http:// or https://, or be a single placeholder",
      });
    }

    return;
  }

  if (!isHttpOrHttpsUrl(url)) {
    ctx.addIssue({
      code: "custom",
      message: "HTTP URL must be a valid http or https URL",
    });
  }
}

const httpConfigSchema = z.object({
  method: z.enum(httpMethods, {
    error: "HTTP method must be GET, POST, PUT, PATCH, or DELETE",
  }),
  url: z
    .string()
    .trim()
    .min(1, "HTTP URL is required")
    .superRefine(validateHttpUrlTemplate),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z
    .number()
    .int()
    .min(100, "timeoutMs must be at least 100")
    .max(30_000, "timeoutMs must be at most 30000")
    .default(DEFAULT_HTTP_TIMEOUT_MS),
});

const conditionConfigSchema = z
  .object({
    left: z.unknown(),
    operator: z.enum(conditionOperators, {
      error: "Unsupported condition operator",
    }),
    right: z.unknown().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.operator !== "exists" && config.right === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Condition right value is required for this operator",
        path: ["right"],
      });
    }
  });

const nodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: requiredId("Node id"),
    type: z.literal("trigger"),
    name: requiredName("Node name"),
    config: z.record(z.string(), z.unknown()),
  }),
  z.object({
    id: requiredId("Node id"),
    type: z.literal("action"),
    name: requiredName("Node name"),
    config: z.record(z.string(), z.unknown()),
  }),
  z.object({
    id: requiredId("Node id"),
    type: z.literal("http"),
    name: requiredName("Node name"),
    config: httpConfigSchema,
  }),
  z.object({
    id: requiredId("Node id"),
    type: z.literal("condition"),
    name: requiredName("Node name"),
    config: conditionConfigSchema,
  }),
]);

const edgeSchema = z.object({
  id: requiredId("Edge id"),
  source: requiredId("Edge source"),
  target: requiredId("Edge target"),
  condition: z
    .enum(edgeConditions, {
      error: 'Edge condition must be "true" or "false"',
    })
    .optional(),
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
