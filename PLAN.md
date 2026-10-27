# Orchestration Engine — Project Plan

## Purpose

Build a developer-focused orchestration engine incrementally while exploring the engineering challenges behind workflow systems and distributed execution.

The engine should eventually be capable of coordinating different kinds of work including:

- APIs
- Application logic
- AI agents and LLMs
- External tools
- Human approvals
- Scheduled processes
- Event-triggered processes

The project is intentionally being built from a small foundation rather than beginning with distributed infrastructure.

## Core Concept

A workflow consists conceptually of:

```text
Trigger
   ↓
Node
   ↓
Node
   ↓
Condition
  ↙     ↘
Node   Node
   ↓
Result
```

The orchestration engine is responsible for determining:

- What should execute
- When it should execute
- What data is passed between steps
- Which path should execute next
- What happens when a step fails
- How execution state is tracked
- How interrupted workflows can eventually resume

## Initial Product Direction

The project should gradually explore:

### Workflow Definition

Represent workflows using nodes and relationships between nodes.

Possible node categories may eventually include:

- HTTP requests
- Data transformation
- Conditions
- LLM calls
- Agent execution
- Human approval
- Delays
- Custom functions

### Execution Engine

Build the logic responsible for interpreting workflow definitions and executing them.

Important concepts include:

- Execution context
- Node inputs
- Node outputs
- Dependency resolution
- Branching
- Execution state

### Reliability

As execution becomes more complex, explore:

- Failure handling
- Timeouts
- Retries
- Exponential backoff
- Idempotency
- Cancellation
- Dead-letter handling

### Durable Execution

Long-running workflows should eventually survive application or worker restarts.

Potential concepts include:

- Persistent workflow state
- Checkpoints
- Execution recovery
- Waiting workflows
- Event-based resumption

### Asynchronous Execution

When synchronous execution becomes limiting, the architecture may evolve toward:

```text
API
 ↓
Scheduler
 ↓
Queue
 ↓
Workers
```

Technologies such as Redis, BullMQ, message brokers, or event systems should only be introduced when the architecture actually requires them.

### Distributed Execution

Later stages may explore:

- Multiple workers
- Distributed locks
- Concurrency control
- Worker coordination
- Event-driven services
- Horizontal scaling
- Workflow partitioning

### AI and Agent Orchestration

AI should be treated as one execution capability within the engine rather than making the entire architecture dependent on AI.

Possible capabilities include:

```text
Workflow
   ↓
LLM Node
   ↓
Tool Node
   ↓
Agent
   ↓
Human Approval
   ↓
External API
```

Potential exploration areas:

- Tool registries
- Agent execution
- Structured LLM output
- Agent-to-agent workflows
- Human-in-the-loop execution
- Model usage tracking

### Observability

As workflows become distributed, explore:

- Execution logs
- Node-level timing
- Workflow traces
- Metrics
- Failure inspection
- Distributed tracing
- OpenTelemetry

### Platform Capabilities

If the engine evolves into a hosted platform, future areas may include:

- Authentication
- Organizations/workspaces
- Secrets management
- Multi-tenancy
- Workflow versioning
- Usage metering
- Billing
- API keys
- Developer APIs

These are not required for the initial engine.

## Engineering Philosophy

The project should evolve because of engineering requirements, not because particular technologies are popular.

For example:

```text
Long-running requests become problematic
→ introduce background execution
```

```text
Background execution requires coordination
→ introduce a queue
```

```text
Workflow recovery becomes necessary
→ introduce persistent checkpoints
```

```text
A single worker becomes a bottleneck
→ introduce multiple workers
```

```text
Cross-process execution becomes difficult to debug
→ introduce distributed tracing
```

The evolution of the architecture is part of the purpose of the project.

## Long-Term Goal

The final direction is a system capable of reliably coordinating workflows involving APIs, software services, AI agents, and human actions while providing execution state, resilience, observability, and scalability.

The exact architecture is intentionally not fixed in advance.

Architectural decisions should emerge from the problems encountered while building the engine.
