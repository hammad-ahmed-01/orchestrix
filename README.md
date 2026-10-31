# Orchestration Engine

An orchestration engine being built incrementally to explore workflow execution, distributed systems, durable execution, AI tooling, and high-scale backend engineering.

This repository intentionally begins with a minimal architecture. New infrastructure will be added only when a concrete requirement justifies it.

## Current State

Workflows can be defined, validated, and stored. Workflow execution is not implemented yet.

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

`POST /workflows` stores a definition, `GET /workflows` lists workflows without the full graph, and `GET /workflows/:id` returns one definition. Node and edge ids are supplied by the client so connections stay explicit. The server generates the workflow id. Stored workflows live in process memory and are discarded on restart.

A workflow needs exactly one `trigger` node, and that trigger cannot have an incoming edge. Supported node types are `trigger` and `action`. These nodes describe the graph only.

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
