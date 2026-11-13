export class RunNotFoundError extends Error {
  constructor() {
    super("Workflow run not found");
    this.name = "RunNotFoundError";
  }
}

export class PersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PersistenceError";

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
