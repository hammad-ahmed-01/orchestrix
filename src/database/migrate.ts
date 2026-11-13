import type { DatabaseSync } from "node:sqlite";
import {
  version as initialVersion,
  sql as initialSql,
} from "./migrations/001_initial.js";

type Migration = {
  version: number;
  sql: string;
};

const migrations: Migration[] = [
  {
    version: initialVersion,
    sql: initialSql,
  },
];

export function applyMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => {
        if (!isRecord(row) || typeof row.version !== "number") {
          throw new Error("Invalid schema_migrations row");
        }

        return row.version;
      }),
  );

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    db.exec("BEGIN");

    try {
      db.exec(migration.sql);
      insertMigration.run(migration.version, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
