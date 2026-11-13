import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { isDatabaseReady } from "../database/database.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPackageVersion(): string {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../package.json",
  );
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (!isRecord(parsed) || typeof parsed.version !== "string") {
    throw new Error("Unable to read the application version.");
  }

  return parsed.version;
}

const version = readPackageVersion();

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const databaseReady = isDatabaseReady();

  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ok" : "degraded",
    service: "orchestrix",
    version,
    database: databaseReady ? "connected" : "unavailable",
  });
});
