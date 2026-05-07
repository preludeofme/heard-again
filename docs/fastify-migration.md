# Chat Service: Next.js → Fastify Migration

The Chat service is a backend-only API (24 endpoints, no UI). Next.js adds build
overhead, a `.next` cache, and framework abstractions that provide no benefit here.
Fastify is a direct replacement: same Node.js runtime, same TypeScript, same port,
no frontend baggage.

**Scope:** `Chat/` service only. The `UI/` service is not affected.

---

## What Changes

| Area | Before | After |
|---|---|---|
| Framework | `next@14` (API routes only) | `fastify@4` |
| Entry point | `next dev / next start` | `src/server.ts` |
| Routes | `src/pages/api/**/*.ts` | `src/routes/**/*.ts` |
| Dynamic params | `[sessionId].ts` | `:sessionId` in route path |
| Request type | `NextApiRequest` | `FastifyRequest` |
| Response type | `NextApiResponse` | `FastifyReply` |
| Rate limiting | `express-rate-limit` | `@fastify/rate-limit` |
| Security headers | `helmet` (manual) | `@fastify/helmet` |
| Build step | `next build` (required) | None — run TypeScript directly via `tsx` |
| Dev startup | `~8s` (Next.js cold start) | `~300ms` |

**Not changing:** Prisma, BullMQ, Redis, ChromaDB, Ollama, Winston, Zod, all service
and repository classes. The `src/workers/` directory is unchanged.

---

## Step 1 — Update Dependencies

```bash
cd Chat

# Remove Next.js
npm uninstall next react react-dom @types/react @types/react-dom

# Add Fastify
npm install fastify@4 \
  @fastify/helmet \
  @fastify/rate-limit \
  @fastify/cors \
  @fastify/multipart

# Add dev tooling (tsx already present for workers — verify)
npm install --save-dev @types/node
```

Verify `tsx` and `tsconfig-paths` are in `devDependencies` — they're already used
by the ingestion worker and are needed for the new entry point too.

---

## Step 2 — Create the Entry Point

Create `Chat/src/server.ts`. This replaces `next dev` / `next start`.

```typescript
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { logger } from '@/lib/logger';
import { registerRoutes } from '@/routes';

const PORT = parseInt(process.env.PORT ?? '4778', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: false, // use existing Winston logger
    trustProxy: true,
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
  });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — match existing limit
  });

  registerRoutes(app);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
  logger.info(`Chat service listening on ${HOST}:${PORT}`);
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
```

---

## Step 3 — Create Route Registry

Create `Chat/src/routes/index.ts`. This replaces Next.js's filesystem-based routing.

```typescript
import type { FastifyInstance } from 'fastify';
import { registerChatRoutes } from './chat';
import { registerIngestionRoutes } from './ingestion';
import { registerPersonaRoutes } from './persona';
import { registerVoiceRoutes } from './voice';
import { registerHealthRoutes } from './health';
import { registerMiscRoutes } from './misc';

export function registerRoutes(app: FastifyInstance): void {
  registerHealthRoutes(app);
  registerChatRoutes(app);
  registerIngestionRoutes(app);
  registerPersonaRoutes(app);
  registerVoiceRoutes(app);
  registerMiscRoutes(app);
}
```

---

## Step 4 — Migrate Auth Patterns

The two auth patterns used inline across all routes become reusable Fastify hooks.

### Bearer token hook

Replaces the `verifyServiceToken(req, res)` early-return pattern.

```typescript
// src/hooks/auth.ts
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function bearerAuthHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== process.env.CHAT_SERVICE_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

export function serviceSecretHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const secret = req.headers['x-chat-service-secret'];
  if (!secret || secret !== process.env.CHAT_SERVICE_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

export function requireContextHeadersHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  if (!req.headers['x-familyspace-id'] || !req.headers['x-user-id']) {
    reply.code(400).send({ error: 'Missing required context headers' });
    return;
  }
  done();
}
```

Apply per route:

```typescript
app.post('/api/chat/stream', {
  preHandler: [bearerAuthHook, requireContextHeadersHook],
}, handler);

app.post('/api/ingestion/ingest', {
  preHandler: [serviceSecretHook],
}, handler);
```

---

## Step 5 — Migrate Route Handlers

### Request/response type mapping

| Next.js | Fastify |
|---|---|
| `NextApiRequest` | `FastifyRequest` |
| `NextApiResponse` | `FastifyReply` |
| `req.body` | `req.body` (same, auto-parsed) |
| `req.query.id` | `req.params.id` (path) or `req.query.id` (query string) |
| `req.headers['x-familyspace-id']` | `req.headers['x-familyspace-id']` (same) |
| `res.status(200).json({...})` | `reply.code(200).send({...})` |
| `res.status(400).json({error})` | `reply.code(400).send({error})` |
| `res.setHeader('Content-Type', ...)` | `reply.header('Content-Type', ...)` |
| Method guard `if (req.method !== 'POST')` | Declare method in route registration |

### Example: simple route migration

**Before** (`src/pages/api/chat/sessions.ts`):
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyServiceToken(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();
  // ... logic
  res.status(201).json(session);
}
```

**After** (`src/routes/chat.ts`):
```typescript
export function registerChatRoutes(app: FastifyInstance): void {
  app.post('/api/chat/sessions', {
    preHandler: [bearerAuthHook, requireContextHeadersHook],
  }, async (req, reply) => {
    // ... same logic, no changes to service calls
    return reply.code(201).send(session);
  });
}
```

### Dynamic route segments

| Next.js filename | Fastify route path |
|---|---|
| `sessions/[sessionId].ts` | `/api/chat/sessions/:sessionId` |
| `persona/[personId].ts` | `/api/persona/:personId` |
| `persona/[personId]/generate.ts` | `/api/persona/:personId/generate` |
| `ingestion/jobs/[id].ts` | `/api/ingestion/jobs/:id` |

Access via `req.params.sessionId` instead of `req.query.sessionId`.

---

## Step 6 — Migrate SSE Streaming

The `/api/chat/stream` route uses server-sent events. Fastify handles this cleanly
without the `responseLimit: false` workaround needed in Next.js.

**Before:**
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.flushHeaders();
// write events with res.write() + res.flush()
```

**After:**
```typescript
app.post('/api/chat/stream', {
  preHandler: [bearerAuthHook, requireContextHeadersHook],
}, async (req, reply) => {
  reply
    .header('Content-Type', 'text/event-stream')
    .header('Cache-Control', 'no-cache')
    .header('Connection', 'keep-alive');

  const stream = new PassThrough();
  reply.send(stream);

  // write events
  stream.write(`data: ${JSON.stringify(chunk)}\n\n`);

  // end
  stream.end();
});
```

Import `PassThrough` from `'node:stream'`. The pattern is identical — only the
response API changes.

---

## Step 7 — Update tsconfig.json

Replace `"moduleResolution": "bundler"` (Next.js-specific) with `"node16"` or
`"nodenext"`, and set `"module"` to match.

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/types/*": ["./src/types/*"],
      "@/services/*": ["./src/services/*"],
      "@/utils/*": ["./src/utils/*"]
    },
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 8 — Update package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch -r tsconfig-paths/register src/server.ts",
    "start": "node -r tsconfig-paths/register dist/server.js",
    "build": "tsc --noEmit",
    "type-check": "tsc --noEmit",
    "ingestion:worker": "tsx -r tsconfig-paths/register src/workers/worker-server.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "migration:dev": "prisma migrate dev",
    "migration:deploy": "prisma migrate deploy"
  }
}
```

`tsx watch` gives hot-reload on save in development. The ingestion worker script
is unchanged.

---

## Step 9 — Update Dockerfile

**Before:**
```dockerfile
RUN npm run build          # next build
CMD ["npm", "start"]       # next start
```

**After:**
```dockerfile
# No build step required for development
# For production, compile TypeScript first:
RUN npx tsc
CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]
```

Or use `tsx` directly to skip the compile step in containers where cold start
time is acceptable:

```dockerfile
CMD ["npx", "tsx", "-r", "tsconfig-paths/register", "src/server.ts"]
```

Remove any `COPY .next /app/.next` lines and any Next.js cache volumes from the
Compose file.

---

## Step 10 — Remove Next.js Artifacts

```bash
cd Chat
rm -rf .next next.config.js next-env.d.ts
# Remove next from dependencies in package.json (already done in Step 1)
```

Update `Chat/docker/Dockerfile` — remove the `next build` stage and `.next` copy.

---

## Full Route Map

All 24 routes — existing path → Fastify registration:

| Existing path | Method(s) | Auth | Fastify file |
|---|---|---|---|
| `/api/chat/messages` | GET, POST | Bearer | `routes/chat.ts` |
| `/api/chat/stream` | POST | Bearer | `routes/chat.ts` |
| `/api/chat/sessions` | POST | Bearer | `routes/chat.ts` |
| `/api/chat/sessions/[sessionId]` | GET, PUT, DELETE | Bearer | `routes/chat.ts` |
| `/api/health` | GET | None | `routes/health.ts` |
| `/api/health/detailed` | GET | None | `routes/health.ts` |
| `/api/ready` | GET | None | `routes/health.ts` |
| `/api/live` | GET, POST | None | `routes/health.ts` |
| `/api/metrics` | GET, POST | None | `routes/health.ts` |
| `/api/worker/health` | GET | None | `routes/health.ts` |
| `/api/ingestion/ingest` | POST | Service secret | `routes/ingestion.ts` |
| `/api/ingestion/upload` | POST | None | `routes/ingestion.ts` |
| `/api/ingestion/delete` | DELETE | Service secret | `routes/ingestion.ts` |
| `/api/ingestion/jobs/[id]` | GET | None | `routes/ingestion.ts` |
| `/api/ingest/stories` | POST | Config-based | `routes/ingestion.ts` |
| `/api/persona/profiles` | GET, POST, PUT | Bearer | `routes/persona.ts` |
| `/api/persona/[personId]` | GET, PUT, DELETE | Bearer | `routes/persona.ts` |
| `/api/persona/[personId]/generate` | POST | Bearer | `routes/persona.ts` |
| `/api/persona/instructions` | GET, POST | Bearer | `routes/persona.ts` |
| `/api/interview/person` | POST | Bearer | `routes/misc.ts` |
| `/api/rewrite/first-person` | POST | Bearer | `routes/misc.ts` |
| `/api/voice/profiles` | GET | None | `routes/voice.ts` |
| `/api/voice/stream` | POST | None | `routes/voice.ts` |
| `/api/voice/synthesize` | POST | None | `routes/voice.ts` |

---

## Validation Checklist

Run these after migration to confirm parity:

```bash
# Type check
cd Chat && npm run type-check

# Unit tests
cd Chat && npm test

# Start the server
npm run dev

# Health check
curl http://localhost:4778/api/health

# Auth check — expect 401
curl -X POST http://localhost:4778/api/chat/sessions

# Auth check — expect 400 (missing context headers)
curl -X POST http://localhost:4778/api/chat/sessions \
  -H "Authorization: Bearer $CHAT_SERVICE_SECRET"

# Ingestion health
curl http://localhost:4778/api/worker/health

# Confirm .next directory is gone
ls Chat/.next  # should: No such file or directory
```

---

## Known Gotchas

- **`req.query` vs `req.params`**: In Next.js, dynamic segments (`[id]`) come
  through `req.query`. In Fastify they are `req.params`. Query strings remain
  `req.query`. This is the most common source of migration bugs.

- **Method handling**: Next.js routes handle all methods in one file with manual
  `if (req.method !== 'POST')` guards. In Fastify, register each method separately
  (`app.get`, `app.post`, etc.) — the method guard disappears.

- **`moduleResolution: bundler`**: This is a Next.js-specific setting. Switch to
  `node` or `node16` after removing Next.js or TypeScript will error on Fastify
  imports.

- **`@fastify/multipart` vs formidable**: The existing ingestion upload route uses
  formidable for multipart parsing. `@fastify/multipart` is the Fastify-native
  equivalent. The API differs — read the multipart migration note in the
  `@fastify/multipart` docs before migrating `/api/ingestion/upload`.

- **SSE and `res.flush()`**: Next.js requires `res.flush()` to push SSE chunks
  through the buffer. With Fastify + `PassThrough`, writes go directly to the
  response stream — no flush call needed.

- **`experimental-https`**: The dev script uses `--experimental-https`. With
  Fastify, use a local reverse proxy (Caddy or mkcert) for HTTPS in dev, or
  drop HTTPS in local dev entirely since the Caddy proxy already handles TLS
  termination.
