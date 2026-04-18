# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heard Again is a multi-service application for preserving family stories through voice, text, and media. It combines a primary Next.js web app, an AI chat system (RAG + LLM), and a Python TTS voice synthesis service.

## Services & Ports

| Service | Port | Notes |
|---------|------|-------|
| UI (Next.js) | 4776 (internal) → 4777 (Caddy proxy) | Main web app |
| Chat (Next.js) | 4778 | AI chat, RAG, persona engine |
| TTS (FastAPI) | 4779 | Voice synthesis (GPU) |
| PostgreSQL | 5432 | Shared via unified Prisma schema |
| Redis | 6379 | Rate limiting + BullMQ queues |
| ChromaDB | 8000 (internal) | Vector DB for RAG context |
| Ollama | 11434 (internal) | LLM inference |
| ClamAV | 3310 | Virus scanning for uploads |

## Commands

### Full Stack Development

```bash
npm run dev               # Start all services via Scripts/start-dev.sh --live
npm run build             # Build UI for production
npm run docker:up         # Start Docker services
npm run docker:down       # Stop Docker services
```

### UI Service (`cd UI`)

```bash
npm run dev               # Next.js dev on port 4776 (webpack mode)
npm run dev:debug         # Dev with full debug logging
npm run build             # Production build
npm run lint              # ESLint
npm run test              # Jest
npm run test:watch        # Jest watch mode
npm run test:coverage     # Jest with coverage report
```

### Chat Service (`cd Chat`)

```bash
npm run dev               # Next.js dev on port 4778
npm run type-check        # tsc --noEmit
npm run test              # Jest
npm run test:watch        # Jest watch mode
npm run ingestion:worker  # Start BullMQ ingestion worker
npm run eval:baseline     # Run evaluation baseline
npm run eval:compare      # Compare eval results
npm run eval:release-candidate  # Full release eval suite
```

### Database (run from root or UI)

```bash
npm run db:generate       # prisma generate
npm run db:migrate        # prisma migrate dev
npm run db:push           # prisma db push (schema only, no migrations)
npm run db:studio         # Prisma Studio GUI
npm run db:seed           # Seed database (tsx ../prisma/seed.ts)
```

### TTS Service (`cd TTS`)

```bash
# Python FastAPI — requires virtual environment and GPU
pip install -r requirements.txt
uvicorn app.main:app --reload --port 4779
```

### E2E Tests

```bash
npm run e2e:test          # Playwright headless
npm run e2e:test:ui       # Playwright with UI
```

### SonarQube (optional)

```bash
npm run sonar:start       # Start SonarQube container
npm run sonar:scan        # Run analysis
npm run sonar:stop        # Stop SonarQube
```

## Architecture

### UI (`/UI`)

Next.js 16 + React 19 + TypeScript. Pages Router (not App Router). Material UI v7 + Emotion for styling.

Key patterns:
- `SelectedFamilyMemberContext` — central context driving which family member's data loads across all components
- `UI/src/pages/api/` — all API routes; thin handlers delegating to services
- `UI/src/lib/security/` — CSRF, rate limiting, file validation, MFA, security headers (all security primitives live here)
- `UI/src/lib/storage/` — provider-based storage abstraction (local/S3/GCP, swapped via env)
- `UI/src/lib/file-optimizer/` — per-type (audio/image/video/document) optimization pipeline before upload
- NextAuth with custom session handler in `UI/src/lib/auth.ts` and `UI/src/lib/session-handler.ts`
- Middleware (`UI/src/middleware.ts`) handles auth guard, rate limiting, and security header injection

### Chat (`/Chat`)

Next.js 14 + TypeScript. Provides AI chat powered by family history documents.

Key patterns:
- RAG pipeline: document ingestion → ChromaDB → context retrieval → Ollama LLM response
- BullMQ worker (`src/workers/`) handles async document ingestion
- Persona system: prompts + style tuning per family member (see `docs/STRICT_PERSONA_SYSTEM.md`)
- Evaluation framework in `evals/` and `npm run eval:*` scripts for release quality gating
- Repository pattern in `src/repositories/` — all DB access isolated here

### TTS (`/TTS`)

Python FastAPI service. Qwen3-TTS model for voice cloning + synthesis.

Key patterns:
- Dual model management (`model_manager.py`) — balances VRAM
- Voice cloning uses reference audio uploaded by users
- Style presets in `style_presets.py` (warm, gentle, excited, nostalgic)
- Auth middleware in `auth.py` includes rate limiting

### Database (`/prisma`)

Unified Prisma schema (`prisma/schema.prisma`) shared across services. PostgreSQL 15. Migrations in `prisma/migrations/`. All schema changes go through `npm run db:migrate`.

### Infrastructure

- `docker-compose.yml` — production; 10 services with GPU profiles (`with-tts`, `with-llm`, `with-ingestion`)
- `docker-compose.dev.yml` — development variant
- `Caddyfile` — Tailscale HTTPS reverse proxy: external HTTPS → internal :4776 (UI), exposes on :4777
- `Scripts/` — dev lifecycle scripts (startup, health checks, VRAM management, log aggregation)

## Environment Variables

Each service has its own `.env.example`:
- `UI/.env.example` — NextAuth secret, DB URL, storage provider config, service URLs
- `Chat/.env.example` — Ollama endpoint, ChromaDB URL, Redis URL, DB URL
- `TTS/.env.example` — model paths, GPU config, API keys

Copy each `.env.example` to `.env` before first run.

## Testing Approach

- **Unit tests**: Jest in both `UI` and `Chat`, colocated in `__tests__/` directories
- **E2E tests**: Playwright in `/e2e/`, configured via `playwright.config.ts`
- **Chat evaluations**: Custom eval framework in `Chat/evals/` — run before releases via `npm run eval:release-candidate`
- Run nearest related tests during development; full suite only before merge

## Path Aliases

- UI: `@/*` → `src/*`
- Chat: `@/services`, `@/utils`, `@/components`, `@/config` (see `Chat/tsconfig.json`)

## Key Docs

- `docs/CHAT_SYSTEM_ARCHITECTURE.md` — RAG pipeline design
- `docs/STRICT_PERSONA_SYSTEM.md` — AI persona prompt engineering
- `docs/QWEN3_TTS_SETUP_GUIDE.md` — TTS model setup and GPU requirements
- `DEVELOPMENT_SETUP.md` — first-time environment setup
- `AGENTS.md` — agent behavior guidelines
