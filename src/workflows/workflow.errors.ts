export type WorkflowValidationIssue = {
  field: string;
  message: string;
};

export class WorkflowValidationError extends Error {
  readonly details: WorkflowValidationIssue[];

  constructor(details: WorkflowValidationIssue[]) {
    super("Workflow definition is invalid");
    this.name = "WorkflowValidationError";
    this.details = details;
  }
}

export class WorkflowNotFoundError extends Error {
  constructor() {
    super("Workflow not found");
    this.name = "WorkflowNotFoundError";
  }
}
