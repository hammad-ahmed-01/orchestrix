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
- Branch-aware conditional execution
- Execution context
- Trigger nodes
- Action nodes with basic value resolution
- HTTP nodes
- Conditional nodes
- Conditional branching
- Node-level execution results, including skipped branches

`POST /workflows` stores a definition. `GET /workflows` lists workflows without the full graph. `GET /workflows/:id` returns one definition. `POST /workflows/:id/run` executes a stored workflow synchronously and returns the run result.

Supported node types are `trigger`, `action`, `http`, and `condition`. Node and edge ids are supplied by the client. The server generates workflow and run ids. Workflows and runs live in process memory and are discarded on restart.

Templates such as `{{input.companyId}}` and `{{nodes.fetch-company.body.employeeCount}}` can resolve values from workflow input and previous node outputs. Condition nodes select a `true` or `false` outgoing edge. Unselected branches are skipped and do not contribute to the workflow output.

### Current Limitations

- Everything runs in one process
- Workflows are stored in memory
- Runs are not persisted
- HTTP requests are synchronous from the workflow's perspective
- No retries
- No scheduling
- No background workers
- No durable execution
- No secret store
- No authentication
- No LLM or agent nodes
- Production-grade SSRF protections are not implemented

HTTP nodes accept caller-provided URLs. Only `http` and `https` are allowed, but outbound request restrictions suitable for multi-tenant production hosting are not implemented yet.

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
