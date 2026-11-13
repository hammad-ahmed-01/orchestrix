import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initDatabase } from "./database/database.js";
import { warnAboutStaleRunningRuns } from "./execution/run.store.js";

initDatabase();
warnAboutStaleRunningRuns();

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Application started");
});
