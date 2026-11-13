# Orchestrix V0.1 Architecture

## Architecture

```text
Express
+
Synchronous Execution Engine
+
SQLite
```

V0.1 is a single Node.js process. The HTTP API, execution engine, and SQLite database all live in that process.

## Why SQLite?

V0.1 needs durable workflow definitions and run history, but it does not yet require external database infrastructure. SQLite keeps persistence local, explicit, and easy to inspect while the execution model remains simple.

Orchestrix uses Node.js built-in `node:sqlite` with explicit SQL. There is no ORM.

## Why synchronous execution?

Workflows are still small enough to run inside the API request. Introducing queues and workers before they are required would add complexity without solving a current problem.

## Persistent history ≠ durable execution

Runs and node results are written to SQLite as execution progresses. That creates useful history and crash visibility.

It does not mean interrupted runs resume. If the process stops while a run is `running`, V0.1 leaves that row as incomplete history. Automatic recovery belongs to a later durable-execution stage.

## Known limitation

An execution interrupted by process termination cannot yet resume.
