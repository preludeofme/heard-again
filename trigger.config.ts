import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_tmgbtzgspjocfgztdorx",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["UI/src/trigger"],
  build: {
    extensions: [
      prismaExtension({
        schema: "prisma/schema.prisma",
      }),
      syncEnvVars(async (ctx) => {
        const vars: { name: string; value: string }[] = [];
        // Accept either DATABASE_URL or POSTGRES_URL as the source so tasks work
        // regardless of which var the user added to the Trigger.dev project settings.
        const dbUrl = ctx.env.DATABASE_URL || ctx.env.POSTGRES_URL;
        if (dbUrl) {
          if (!ctx.env.DATABASE_URL) {
            vars.push({ name: "DATABASE_URL", value: dbUrl });
          }
          if (!ctx.env.POSTGRES_URL) {
            vars.push({ name: "POSTGRES_URL", value: dbUrl });
          }
          if (!ctx.env.POSTGRES_URL_NON_POOLING) {
            vars.push({ name: "POSTGRES_URL_NON_POOLING", value: dbUrl });
          }
        }
        return vars;
      }),
    ],
  },
});
