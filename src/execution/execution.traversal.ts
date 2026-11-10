import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "../workflows/workflow.types.js";

export type EdgeActivation = "pending" | "active" | "inactive";

export type TraversalNodeState =
  "pending" | "ready" | "completed" | "failed" | "skipped";

export type ExecutionTraversal = {
  getReadyNodeIds: () => string[];
  markCompleted: (nodeId: string, conditionResult?: boolean) => void;
  markSkipped: (nodeId: string) => void;
  propagate: () => void;
  getNodeState: (nodeId: string) => TraversalNodeState;
  getSkippedNodeIds: () => string[];
};

export function createExecutionTraversal(
  workflow: Workflow,
): ExecutionTraversal {
  const edgeStates = new Map<string, EdgeActivation>();
  const nodeStates = new Map<string, TraversalNodeState>();
  const outgoingBySource = new Map<string, WorkflowEdge[]>();
  const incomingByTarget = new Map<string, WorkflowEdge[]>();

  for (const node of workflow.nodes) {
    nodeStates.set(node.id, "pending");
    outgoingBySource.set(node.id, []);
    incomingByTarget.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    edgeStates.set(edge.id, "pending");
    outgoingBySource.get(edge.source)?.push(edge);
    incomingByTarget.get(edge.target)?.push(edge);
  }

  for (const node of workflow.nodes) {
    if ((incomingByTarget.get(node.id) ?? []).length === 0) {
      nodeStates.set(node.id, "ready");
    }
  }

  const getReadyNodeIds = (): string[] =>
    [...nodeStates.entries()]
      .filter(([, state]) => state === "ready")
      .map(([nodeId]) => nodeId)
      .sort((left, right) => left.localeCompare(right));

  const deactivateOutgoing = (nodeId: string): void => {
    for (const edge of outgoingBySource.get(nodeId) ?? []) {
      edgeStates.set(edge.id, "inactive");
    }
  };

  const activateOutgoing = (
    node: WorkflowNode,
    conditionResult?: boolean,
  ): void => {
    const outgoing = outgoingBySource.get(node.id) ?? [];

    if (node.type === "condition") {
      if (conditionResult === undefined) {
        throw new Error(
          `Condition result is required to activate edges from "${node.id}"`,
        );
      }

      for (const edge of outgoing) {
        if (edge.condition === "true") {
          edgeStates.set(edge.id, conditionResult ? "active" : "inactive");
        } else if (edge.condition === "false") {
          edgeStates.set(edge.id, conditionResult ? "inactive" : "active");
        } else {
          edgeStates.set(edge.id, "inactive");
        }
      }

      return;
    }

    for (const edge of outgoing) {
      edgeStates.set(edge.id, "active");
    }
  };

  const propagate = (): void => {
    let changed = true;

    while (changed) {
      changed = false;

      for (const node of workflow.nodes) {
        if (nodeStates.get(node.id) !== "pending") {
          continue;
        }

        const incoming = incomingByTarget.get(node.id) ?? [];

        if (incoming.some((edge) => edgeStates.get(edge.id) === "pending")) {
          continue;
        }

        if (incoming.some((edge) => edgeStates.get(edge.id) === "active")) {
          nodeStates.set(node.id, "ready");
          changed = true;
          continue;
        }

        nodeStates.set(node.id, "skipped");
        deactivateOutgoing(node.id);
        changed = true;
      }
    }
  };

  return {
    getReadyNodeIds,
    markCompleted(nodeId, conditionResult) {
      const node = workflow.nodes.find((entry) => entry.id === nodeId);

      if (node === undefined) {
        throw new Error(`Unknown node "${nodeId}"`);
      }

      nodeStates.set(nodeId, "completed");
      activateOutgoing(node, conditionResult);
      propagate();
    },
    markSkipped(nodeId) {
      nodeStates.set(nodeId, "skipped");
      deactivateOutgoing(nodeId);
      propagate();
    },
    propagate,
    getNodeState(nodeId) {
      return nodeStates.get(nodeId) ?? "pending";
    },
    getSkippedNodeIds() {
      return [...nodeStates.entries()]
        .filter(([, state]) => state === "skipped")
        .map(([nodeId]) => nodeId)
        .sort((left, right) => left.localeCompare(right));
    },
  };
}
