import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { applyMigrations } from "./migrate.js";

let database: DatabaseSync | undefined;

export function initDatabase(
  databasePath: string = env.DATABASE_PATH,
): DatabaseSync {
  if (database !== undefined) {
    return database;
  }

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");

  applyMigrations(db);
  database = db;

  logger.info({ databasePath }, "Database initialized");
  return db;
}

export function getDb(): DatabaseSync {
  if (database === undefined) {
    throw new Error("Database has not been initialized");
  }

  return database;
}

export function closeDatabase(): void {
  if (database === undefined) {
    return;
  }

  database.close();
  database = undefined;
}

export function resetDatabase(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM node_execution_results;
    DELETE FROM workflow_runs;
    DELETE FROM workflow_edges;
    DELETE FROM workflow_nodes;
    DELETE FROM workflows;
  `);
}

export function isDatabaseReady(): boolean {
  try {
    getDb().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");

  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
