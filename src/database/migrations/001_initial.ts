export const version = 1;

export const sql = `
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workflow_nodes (
  id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workflow_id, id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE workflow_edges (
  id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  condition TEXT CHECK (condition IS NULL OR condition IN ('true', 'false')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workflow_id, id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id, source_node_id)
    REFERENCES workflow_nodes(workflow_id, id),
  FOREIGN KEY (workflow_id, target_node_id)
    REFERENCES workflow_nodes(workflow_id, id)
);

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE node_execution_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'skipped')),
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  execution_order INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
  UNIQUE (run_id, execution_order)
);

CREATE INDEX idx_workflow_runs_started_at ON workflow_runs(started_at DESC);
CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_node_execution_results_run_id
  ON node_execution_results(run_id, execution_order);
`;
