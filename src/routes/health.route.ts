import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";

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
  res.status(200).json({
    status: "ok",
    service: "orchestration-engine",
    version,
  });
});
