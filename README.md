# Orchestration Engine

An orchestration engine being built incrementally to explore workflow execution, distributed systems, durable execution, AI tooling, and high-scale backend engineering.

This repository intentionally begins with a minimal architecture. New infrastructure will be added only when a concrete requirement justifies it.

## Current State

Workflows can be defined, validated, stored, and executed synchronously inside the API process.

Currently implemented:

- Node.js + TypeScript application
- Express HTTP server
- Environment validation
- Structured logging
- Health endpoint
- Centralized error handling
- Workflow definitions made of nodes and edges
- Graph validation
- In-memory workflow storage
- Workflow REST API
- Manual workflow execution
- Dependency-based execution ordering
- Execution context
- Trigger execution
- Simple `set` action execution
- Node-level execution results

`POST /workflows` stores a definition. `GET /workflows` lists workflows without the full graph. `GET /workflows/:id` returns one definition. `POST /workflows/:id/run` executes a stored workflow synchronously and returns the run result.

Node and edge ids are supplied by the client so connections stay explicit. The server generates workflow and run ids. Stored workflows live in process memory and are discarded on restart. Runs are ephemeral and are not retained as history.

A workflow needs exactly one `trigger` node, and that trigger cannot have an incoming edge. Supported node types are `trigger` and `action`. Draft and active workflows can both be executed manually in this stage.

### Current Limitations

- Execution is synchronous
- Execution happens inside the API process
- Data is stored in memory
- No retries
- No persistence
- No external integrations
- No conditional branching
- No background workers
- No durable execution

## Local Development

Requires Node.js 22 or newer.

```bash
npm install
```

Copy `.env.example` to `.env`, then start the development server:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:4000/health
```

Build, run the compiled server, and check the project:

```bash
npm run build
npm run start
npm run typecheck
npm run test
npm run lint
npm run format
```

## Engineering Approach

Technologies will be introduced when architectural requirements justify them, rather than adding infrastructure before the engine needs it. Databases, queues, workers, and other platform pieces are intentionally absent at this stage.

The longer-term direction is described in [PLAN.md](PLAN.md).
