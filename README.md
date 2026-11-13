# Orchestrix

> A workflow orchestration engine being built incrementally to explore execution engines, durable workflows, distributed systems, AI orchestration, and high-scale backend engineering.

V0.1 intentionally uses a synchronous, single-process architecture with SQLite persistence through Node's built-in `node:sqlite` module and explicit SQL. New infrastructure is added only when a concrete limitation justifies it.

## Current V0.1 Capabilities

- Workflow graph definitions
- DAG validation
- Cycle detection
- Persistent workflow storage
- Trigger nodes
- Action nodes
- HTTP nodes
- Condition nodes
- Conditional branching
- Workflow input
- Previous-node output resolution
- Synchronous execution
- Node-level execution state
- Persistent workflow runs
- Run history
- Execution timing
- Failure visibility

## Current Architecture

```text
                   ┌─────────────────┐
                   │   HTTP Client   │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │     Express     │
                   └────────┬────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
   ┌─────────────────┐             ┌─────────────────┐
   │ Workflow Service│             │Execution Service│
   └────────┬────────┘             └────────┬────────┘
            │                               │
            │                       ┌───────┴─────────┐
            │                       │ Node Executors  │
            │                       │                 │
            │                       │ Trigger         │
            │                       │ Action          │
            │                       │ HTTP            │
            │                       │ Condition       │
            │                       └───────┬─────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
                    ┌───────────────┐
                    │    SQLite     │
                    │               │
                    │ Workflows     │
                    │ Runs          │
                    │ Node Results  │
                    └───────────────┘
```

More detail is in [docs/architecture-v0.1.md](docs/architecture-v0.1.md).

## Why It Is Still Synchronous

V0.1 executes workflows synchronously inside the API process because the current scope does not yet justify background infrastructure.

That creates known limitations:

- Long workflows occupy the API process
- Execution does not survive process termination mid-run
- There are no retries
- There is no worker isolation
- There is no horizontal execution scaling

Persistent history is not the same as durable execution. Runs and node results are stored in SQLite, but incomplete `running` rows are not automatically resumed after a crash.

## V0.1 Limitations

- Single Node.js process
- Synchronous execution
- No background workers
- No retries
- No scheduling
- No workflow resume after crash
- No distributed execution
- No authentication
- No multi-tenancy
- No secret management
- No production SSRF protection
- No LLM or agent nodes
- No frontend

HTTP nodes accept caller-provided URLs. Only `http` and `https` are allowed. Production hosting would need stronger outbound network policy, secret storage, authentication, and tenant isolation.

## Example Workflow

```text
Trigger
   ↓
HTTP
   ↓
Condition
 ↙       ↘
Action  Action
```

```json
{
  "name": "Company Classification",
  "nodes": [
    { "id": "start", "type": "trigger", "name": "Start", "config": {} },
    {
      "id": "fetch-company",
      "type": "http",
      "name": "Fetch Company",
      "config": {
        "method": "GET",
        "url": "https://example.com/company/{{input.companyId}}"
      }
    },
    {
      "id": "check-size",
      "type": "condition",
      "name": "Check Size",
      "config": {
        "left": "{{nodes.fetch-company.body.employeeCount}}",
        "operator": "greater_than",
        "right": 100
      }
    },
    {
      "id": "enterprise",
      "type": "action",
      "name": "Enterprise",
      "config": {
        "operation": "set",
        "values": { "segment": "enterprise" }
      }
    },
    {
      "id": "smb",
      "type": "action",
      "name": "SMB",
      "config": {
        "operation": "set",
        "values": { "segment": "smb" }
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "fetch-company" },
    { "id": "e2", "source": "fetch-company", "target": "check-size" },
    {
      "id": "e3",
      "source": "check-size",
      "target": "enterprise",
      "condition": "true"
    },
    {
      "id": "e4",
      "source": "check-size",
      "target": "smb",
      "condition": "false"
    }
  ]
}
```

## API

```text
GET    /health

POST   /workflows
GET    /workflows
GET    /workflows/:id

POST   /workflows/:id/run
GET    /workflows/:id/runs

GET    /runs
GET    /runs/:id
```

- `GET /health` — service and database readiness
- `POST /workflows` — create a workflow definition
- `GET /workflows` — list workflows
- `GET /workflows/:id` — get one workflow definition
- `POST /workflows/:id/run` — execute a workflow synchronously
- `GET /workflows/:id/runs` — list runs for one workflow
- `GET /runs` — list recent runs
- `GET /runs/:id` — get one run with node results

## Local Development

Requires Node.js 22 or newer.

```bash
npm install
```

Copy `.env.example` to `.env`:

```env
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
DATABASE_PATH=./data/orchestrix.db
```

Then:

```bash
npm run dev
```

Useful commands:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Engineering Approach

The V0.1 path was deliberate:

```text
Basic Node service
       ↓
Workflow definitions
       ↓
Synchronous execution
       ↓
HTTP + branching
       ↓
Persistent workflows and execution history
```

The next natural limitation is visible: long-running workflows still execute inside the API process. That problem is intentionally left for a later stage.
