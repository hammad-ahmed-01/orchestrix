import type { Workflow } from "./workflow.types.js";

/**
 * Process-local workflow storage. Contents are discarded when the process exits.
 */
const workflows = new Map<string, Workflow>();

export const workflowStore = {
  save(workflow: Workflow): void {
    workflows.set(workflow.id, workflow);
  },

  list(): Workflow[] {
    return [...workflows.values()];
  },

  findById(id: string): Workflow | undefined {
    return workflows.get(id);
  },

  clear(): void {
    workflows.clear();
  },
};
