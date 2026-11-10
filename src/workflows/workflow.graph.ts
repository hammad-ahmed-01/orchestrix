import type { WorkflowValidationIssue } from "./workflow.errors.js";
import type { WorkflowEdge, WorkflowNode } from "./workflow.types.js";

export function hasCycle(
  nodes: readonly Pick<WorkflowNode, "id">[],
  edges: readonly Pick<WorkflowEdge, "source" | "target">[],
): boolean {
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (visit(nextNodeId)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}

export function validateWorkflowGraph(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const nodeIds = new Set<string>();
  let graphIsResolvable = true;

  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id)) {
      graphIsResolvable = false;
      issues.push({
        field: `nodes[${String(index)}].id`,
        message: "Node id must be unique",
      });
    }

    nodeIds.add(node.id);
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const edgeIds = new Set<string>();
  let hasSelfLoop = false;

  for (const [index, edge] of edges.entries()) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        field: `edges[${String(index)}].id`,
        message: "Edge id must be unique",
      });
    }

    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      graphIsResolvable = false;
      issues.push({
        field: `edges[${String(index)}].source`,
        message: "Source node does not exist",
      });
    }

    if (!nodeIds.has(edge.target)) {
      graphIsResolvable = false;
      issues.push({
        field: `edges[${String(index)}].target`,
        message: "Target node does not exist",
      });
    }

    if (edge.source === edge.target) {
      hasSelfLoop = true;
      issues.push({
        field: `edges[${String(index)}].target`,
        message: "Edges cannot connect a node to itself",
      });
    }

    const sourceNode = nodesById.get(edge.source);

    if (edge.condition !== undefined) {
      if (sourceNode === undefined || sourceNode.type !== "condition") {
        issues.push({
          field: `edges[${String(index)}].condition`,
          message:
            "Condition labels are only allowed on edges from condition nodes",
        });
      }
    } else if (sourceNode?.type === "condition") {
      issues.push({
        field: `edges[${String(index)}].condition`,
        message:
          'Edges from condition nodes must declare condition "true" or "false"',
      });
    }
  }

  const triggers = nodes.filter((node) => node.type === "trigger");

  if (triggers.length !== 1) {
    issues.push({
      field: "nodes",
      message: "Workflow must contain exactly one trigger node",
    });
  }

  const triggerIds = new Set(triggers.map((node) => node.id));

  for (const [index, edge] of edges.entries()) {
    if (triggerIds.has(edge.target)) {
      issues.push({
        field: `edges[${String(index)}].target`,
        message: "Trigger node cannot have incoming edges",
      });
    }
  }

  for (const node of nodes) {
    if (node.type !== "condition") {
      continue;
    }

    const outgoing = edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => edge.source === node.id);

    const trueEdges = outgoing.filter(({ edge }) => edge.condition === "true");
    const falseEdges = outgoing.filter(
      ({ edge }) => edge.condition === "false",
    );

    if (trueEdges.length === 0) {
      issues.push({
        field: "edges",
        message: `Condition node "${node.id}" must have a true branch`,
      });
    }

    if (falseEdges.length === 0) {
      issues.push({
        field: "edges",
        message: `Condition node "${node.id}" must have a false branch`,
      });
    }

    if (trueEdges.length > 1) {
      for (const { index } of trueEdges.slice(1)) {
        issues.push({
          field: `edges[${String(index)}].condition`,
          message: `Condition node "${node.id}" has duplicate true branches`,
        });
      }
    }

    if (falseEdges.length > 1) {
      for (const { index } of falseEdges.slice(1)) {
        issues.push({
          field: `edges[${String(index)}].condition`,
          message: `Condition node "${node.id}" has duplicate false branches`,
        });
      }
    }
  }

  // Self-loops already have a direct error. Cycle detection covers longer loops.
  if (graphIsResolvable && !hasSelfLoop && hasCycle(nodes, edges)) {
    issues.push({
      field: "edges",
      message: "Workflow contains a cycle",
    });
  }

  return issues;
}
