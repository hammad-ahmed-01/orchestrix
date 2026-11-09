export type RunRequestValidationIssue = {
  field: string;
  message: string;
};

export class InvalidRunRequestError extends Error {
  readonly details: RunRequestValidationIssue[];

  constructor(details: RunRequestValidationIssue[]) {
    super("Workflow run request is invalid");
    this.name = "InvalidRunRequestError";
    this.details = details;
  }
}

export class NodeExecutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NodeExecutionError";
    this.code = code;
  }
}

export class UnsupportedNodeTypeError extends NodeExecutionError {
  constructor(nodeType: string) {
    super(
      "UNSUPPORTED_NODE_TYPE",
      `No executor is registered for node type "${nodeType}"`,
    );
    this.name = "UnsupportedNodeTypeError";
  }
}
