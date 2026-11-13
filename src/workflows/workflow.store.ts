import { getDb, withTransaction } from "../database/database.js";
import { fromJsonText, toJsonText } from "../database/json.js";
import type {
  ConditionNodeConfig,
  EdgeCondition,
  HttpNodeConfig,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowStatus,
} from "./workflow.types.js";
import { edgeConditions, workflowNodeTypes } from "./workflow.types.js";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type NodeRow = {
  id: string;
  workflow_id: string;
  type: string;
  name: string;
  config_json: string;
  created_at: string;
};

type EdgeRow = {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  condition: string | null;
  created_at: string;
};

export const workflowStore = {
  save(workflow: Workflow): void {
    const db = getDb();

    const insertWorkflow = db.prepare(`
      INSERT INTO workflows (
        id, name, description, version, status, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @version, @status, @created_at, @updated_at
      )
    `);

    const insertNode = db.prepare(`
      INSERT INTO workflow_nodes (
        id, workflow_id, type, name, config_json, created_at
      ) VALUES (
        @id, @workflow_id, @type, @name, @config_json, @created_at
      )
    `);

    const insertEdge = db.prepare(`
      INSERT INTO workflow_edges (
        id, workflow_id, source_node_id, target_node_id, condition, created_at
      ) VALUES (
        @id, @workflow_id, @source_node_id, @target_node_id, @condition, @created_at
      )
    `);

    withTransaction(() => {
      insertWorkflow.run({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description ?? null,
        version: workflow.version,
        status: workflow.status,
        created_at: workflow.createdAt,
        updated_at: workflow.updatedAt,
      });

      for (const node of workflow.nodes) {
        insertNode.run({
          id: node.id,
          workflow_id: workflow.id,
          type: node.type,
          name: node.name,
          config_json: toJsonText(node.config),
          created_at: workflow.createdAt,
        });
      }

      for (const edge of workflow.edges) {
        insertEdge.run({
          id: edge.id,
          workflow_id: workflow.id,
          source_node_id: edge.source,
          target_node_id: edge.target,
          condition: edge.condition ?? null,
          created_at: workflow.createdAt,
        });
      }
    });
  },

  list(): Workflow[] {
    const rows = getDb()
      .prepare(
        `
          SELECT id, name, description, version, status, created_at, updated_at
          FROM workflows
          ORDER BY created_at ASC
        `,
      )
      .all() as WorkflowRow[];

    return rows.map((row) => loadWorkflow(row));
  },

  findById(id: string): Workflow | undefined {
    const row = getDb()
      .prepare(
        `
          SELECT id, name, description, version, status, created_at, updated_at
          FROM workflows
          WHERE id = ?
        `,
      )
      .get(id) as WorkflowRow | undefined;

    if (row === undefined) {
      return undefined;
    }

    return loadWorkflow(row);
  },
};

function loadWorkflow(row: WorkflowRow): Workflow {
  const nodes = (
    getDb()
      .prepare(
        `
          SELECT id, workflow_id, type, name, config_json, created_at
          FROM workflow_nodes
          WHERE workflow_id = ?
          ORDER BY rowid ASC
        `,
      )
      .all(row.id) as NodeRow[]
  ).map(mapNode);

  const edges = (
    getDb()
      .prepare(
        `
          SELECT
            id, workflow_id, source_node_id, target_node_id, condition, created_at
          FROM workflow_edges
          WHERE workflow_id = ?
          ORDER BY rowid ASC
        `,
      )
      .all(row.id) as EdgeRow[]
  ).map(mapEdge);

  const workflow: Workflow = {
    id: row.id,
    name: row.name,
    version: row.version,
    status: parseWorkflowStatus(row.status),
    nodes,
    edges,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.description !== null) {
    workflow.description = row.description;
  }

  return workflow;
}

function mapNode(row: NodeRow): WorkflowNode {
  const type = parseNodeType(row.type);
  const config = fromJsonText(row.config_json);

  if (!isPlainObject(config)) {
    throw new Error(`Invalid config for node "${row.id}"`);
  }

  switch (type) {
    case "trigger":
      return {
        id: row.id,
        type: "trigger",
        name: row.name,
        config,
      };
    case "action":
      return {
        id: row.id,
        type: "action",
        name: row.name,
        config,
      };
    case "http":
      return {
        id: row.id,
        type: "http",
        name: row.name,
        config: config as HttpNodeConfig,
      };
    case "condition":
      return {
        id: row.id,
        type: "condition",
        name: row.name,
        config: config as ConditionNodeConfig,
      };
  }
}

function mapEdge(row: EdgeRow): WorkflowEdge {
  const edge: WorkflowEdge = {
    id: row.id,
    source: row.source_node_id,
    target: row.target_node_id,
  };

  if (row.condition !== null) {
    edge.condition = parseEdgeCondition(row.condition);
  }

  return edge;
}

function parseWorkflowStatus(value: string): WorkflowStatus {
  if (value === "draft" || value === "active") {
    return value;
  }

  throw new Error(`Invalid workflow status "${value}"`);
}

function parseNodeType(value: string): WorkflowNodeType {
  if ((workflowNodeTypes as readonly string[]).includes(value)) {
    return value as WorkflowNodeType;
  }

  throw new Error(`Invalid workflow node type "${value}"`);
}

function parseEdgeCondition(value: string): EdgeCondition {
  if ((edgeConditions as readonly string[]).includes(value)) {
    return value as EdgeCondition;
  }

  throw new Error(`Invalid edge condition "${value}"`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
