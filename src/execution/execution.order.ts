import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "../workflows/workflow.types.js";

/**
 * Returns a deterministic topological execution order.
 * When multiple nodes are ready, they are ordered by node id.
 */
export function getExecutionOrder(workflow: Workflow): string[] {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    const dependents = adjacency.get(edge.source);

    if (dependents === undefined) {
      throw new Error(`Unknown edge source "${edge.source}"`);
    }

    dependents.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const ready = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort(compareNodeIds);

  const order: string[] = [];

  while (ready.length > 0) {
    const nodeId = ready.shift();

    if (nodeId === undefined) {
      break;
    }

    order.push(nodeId);

    const dependents = [...(adjacency.get(nodeId) ?? [])].sort(compareNodeIds);

    for (const dependentId of dependents) {
      const remaining = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, remaining);

      if (remaining === 0) {
        insertSorted(ready, dependentId);
      }
    }
  }

  if (order.length !== workflow.nodes.length) {
    throw new Error("Unable to determine a complete execution order");
  }

  return order;
}

export function findTerminalNodeIds(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): string[] {
  const nodesWithOutgoing = new Set(edges.map((edge) => edge.source));

  return nodes
    .map((node) => node.id)
    .filter((nodeId) => !nodesWithOutgoing.has(nodeId))
    .sort(compareNodeIds);
}

function compareNodeIds(left: string, right: string): number {
  return left.localeCompare(right);
}

function insertSorted(values: string[], value: string): void {
  let index = 0;

  while (index < values.length) {
    const current = values[index];

    if (current === undefined || compareNodeIds(current, value) > 0) {
      break;
    }

    index += 1;
  }

  values.splice(index, 0, value);
}
