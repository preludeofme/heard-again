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
    // sharp is a native module — mark as external so the bundler doesn't try to inline it
    external: ["sharp"],
    extensions: [
      prismaExtension({
        schema: "prisma/schema.prisma",
      }),
      syncEnvVars(async (ctx) => {
        const vars: { name: string; value: string }[] = [];

        // Accept either DATABASE_URL or POSTGRES_URL — tasks work regardless of which was added
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

        // Forward storage env vars so GEDCOM import task can read from R2.
        // Set STORAGE_MODE, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
        // R2_ENDPOINT, and optionally R2_REGION / R2_PUBLIC_URL_BASE in the
        // Trigger.dev project environment variables dashboard.
        const storageMode = ctx.env.STORAGE_MODE;
        if (storageMode) {
          vars.push({ name: "STORAGE_MODE", value: storageMode });
        }
        // NEXTAUTH_URL is the app base URL — used by export task for local download links.
        const nextAuthUrl = ctx.env.NEXTAUTH_URL;
        if (nextAuthUrl) vars.push({ name: "NEXTAUTH_URL", value: nextAuthUrl });

        for (const key of [
          "R2_BUCKET_NAME",
          "R2_REGION",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_ENDPOINT",
          "R2_PUBLIC_URL_BASE",
          "R2_PUBLIC_DOMAIN",
          "CLOUDFLARE_ACCOUNT_ID",
        ]) {
          const value = ctx.env[key];
          if (value) vars.push({ name: key, value });
        }

        // Forward TTS vars so narration-render task can reach the correct provider.
        // In production these should be set in Vercel: TTS_PROVIDER=runpod_serverless,
        // RUNPOD_TTS_ENDPOINT_ID, and RUNPOD_API_KEY.
        //
        // TTS_SERVICE_URL: local dev uses http://localhost:4779, but Trigger.dev
        // cloud workers need a public URL. Set TTS_SERVICE_URL_PUBLIC in .env
        // to override (Tailscale Funnel or similar public endpoint).
        for (const key of [
          "TTS_PROVIDER",
          "TTS_SERVICE_URL",
          "TTS_SERVICE_URL_PUBLIC",
          "TTS_SERVICE_TOKEN",
          "RUNPOD_API_KEY",
          "RUNPOD_TTS_ENDPOINT_ID",
          "RUNPOD_ENDPOINT_ID",
          "RUNPOD_POLL_INTERVAL_MS",
          "RUNPOD_POLL_TIMEOUT_MS",
          "RUNPOD_QUEUE_TIMEOUT_MS",
        ]) {
          const value = ctx.env[key];
          if (value) vars.push({ name: key, value });
        }

        // Override TTS_SERVICE_URL with the public variant for cloud deployments
        const publicTtsUrl = ctx.env.TTS_SERVICE_URL_PUBLIC;
        if (publicTtsUrl) {
          // Remove the local TTS_SERVICE_URL if present and replace with public
          const idx = vars.findIndex(v => v.name === "TTS_SERVICE_URL");
          if (idx >= 0) vars[idx] = { name: "TTS_SERVICE_URL", value: publicTtsUrl };
          else vars.push({ name: "TTS_SERVICE_URL", value: publicTtsUrl });
        }

        return vars;
      }),
    ],
  },
});
