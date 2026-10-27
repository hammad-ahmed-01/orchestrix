import { config as loadEnvFile } from "dotenv";
import { z } from "zod";

const envFile = loadEnvFile({ quiet: true });

if (envFile.error && !isMissingEnvFile(envFile.error)) {
  console.error(`Failed to load environment file: ${envFile.error.message}`);
  process.exit(1);
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

type Env = z.infer<typeof envSchema>;

function isMissingEnvFile(error: Error): boolean {
  return "code" in error && error.code === "ENOENT";
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    console.error(`Invalid environment configuration:\n${details}`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
