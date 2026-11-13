import { Router } from "express";
import { RunNotFoundError } from "./run.errors.js";
import { getRun, listRuns } from "./run.service.js";

export const runRouter = Router();

runRouter.get("/runs", (_req, res, next) => {
  try {
    res.status(200).json(listRuns());
  } catch (error) {
    next(error);
  }
});

runRouter.get("/runs/:id", (req, res, next) => {
  try {
    res.status(200).json(getRun(readRunId(req.params.id)));
  } catch (error) {
    next(error);
  }
});

function readRunId(value: string | readonly string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RunNotFoundError();
  }

  return value;
}
