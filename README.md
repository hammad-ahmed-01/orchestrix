# Orchestration Engine

An orchestration engine being built incrementally to explore workflow execution, distributed systems, durable execution, AI tooling, and high-scale backend engineering.

This repository intentionally begins with a minimal architecture. New infrastructure will be added only when a concrete requirement justifies it.

## Current State

The project is at its foundation stage. Workflow execution is not implemented.

Currently implemented:

- Node.js + TypeScript application
- Express HTTP server
- Environment validation
- Structured logging
- Health endpoint
- Centralized error handling

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
npm run lint
npm run format
```

## Engineering Approach

Technologies will be introduced when architectural requirements justify them, rather than adding infrastructure before the engine needs it. Databases, queues, workers, and other platform pieces are intentionally absent at this stage.

The longer-term direction is described in [PLAN.md](PLAN.md).
