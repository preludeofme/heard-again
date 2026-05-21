# Heard Again Project Status

Last updated: 2026-05-20 22:10:40 CDT

## Current goal

Keep Heard Again resumable across agent sessions and continue stabilizing the product after the recent documentation cleanup and Trigger.dev migration work.

## Project summary

Heard Again is a family story preservation platform for preserving family histories through stories, voice, media, AI narration, and family-history chat.

The repository is a multi-service application:

- `UI/` — main Next.js web app using Pages Router, React 19, TypeScript, MUI, NextAuth, and Prisma.
- `Chat/` — family-history chat/RAG service using TypeScript, Ollama, ChromaDB, Redis/BullMQ, and a strict persona system.
- `TTS/` — Python FastAPI/Qwen3-TTS voice synthesis service.
- `prisma/` — unified shared Prisma schema for the app.
- `Scripts/` — local development and operations scripts.
- `docs/` — current and archived architecture, migration, and implementation documentation.

## Active branch and git state at discovery

- Branch: `main`
- Recent HEAD: `35a6074 fix: cleaned up docs`
- Working tree at discovery: only untracked `.claude/` directory was present.
- No tracked file modifications were detected before these project-memory docs were created.

## Important project conventions

- The UI uses Next.js Pages Router, not App Router.
- The UI heavily depends on `SelectedFamilyMemberContext`; most family tree, profile, story, and media views may change based on the active family member.
- Security primitives live under `UI/src/lib/security/`.
- File storage is provider-based under `UI/src/lib/storage/`.
- File optimization and upload handling are under `UI/src/lib/file-optimizer/` and related API routes.
- Prisma schema changes must be followed by Prisma client generation.
- Root `npm run db:generate` delegates to `UI` and uses `prisma/schema.prisma`.
- UI lint is currently a stub because Next.js 16 removed `next lint`; use typecheck/build/tests for meaningful validation unless ESLint config is restored.

## Key service ports

From `CLAUDE.md`:

| Service | Port | Notes |
|---|---:|---|
| UI | 4776 internal / 4777 Caddy proxy | Main web app |
| Chat | 4778 | AI chat/RAG/persona service |
| TTS | 4779 | FastAPI voice synthesis service |
| PostgreSQL | 5432 | Shared DB |
| Redis | 6379 | Rate limiting and queues |
| ChromaDB | 8000 internal | Vector DB |
| Ollama | 11434 internal | LLM inference |
| ClamAV | 3310 | Upload scanning |
| Local Trigger.dev | 3030 | Dashboard/API for local task server |

## Trigger.dev status

Trigger.dev v4 is configured at repository root via `trigger.config.ts`.

Important details:

- Project ID in config: `proj_pcwbloaahiyfikeyicmv`
- Runtime: `node`
- Task directory: `UI/src/trigger`
- Max duration: 3600 seconds
- Retries enabled in dev
- Prisma build extension uses `prisma/schema.prisma`
- `syncEnvVars` forwards database, storage, and TTS/RunPod environment variables into task runtime.

Local Trigger.dev notes from archived local infrastructure analysis:

- Local Trigger.dev API/dashboard expected at `http://localhost:3030`.
- App should use `TRIGGER_API_URL=http://localhost:3030` locally.
- Local Trigger.dev secret key must be present in `UI/.env`.

## Known outstanding work

### Code / implementation

1. Missing RunPod worker handler
   - Expected location: `RunPod/worker/handler.py`
   - Source doc: `docs/archived-dev-docs/OUTSTANDING_TASKS.md`
   - Required actions:
     - `upload_reference`
     - `synthesize_batch`
     - `download_audio` for legacy/pod-mode compatibility if needed
   - Current TypeScript provider exists in `UI/src/lib/tts/runpod-tts-provider.ts`, but the Python worker needed by RunPod serverless is documented as missing.

2. QA blockers from `qa_validation_report.md`
   - Sign out redirects to 404.
   - Profile edit fails with 400 when date fields are empty strings.
   - Relative/person delete can happen without confirmation dialog in at least one profile-preview flow.
   - Media upload flows were not exhaustively retested after blockers.

### Manual / infrastructure

Completed per Ryan on 2026-05-20:

- Production Google OAuth credentials updated.
- Vercel env set:
  - `TTS_PROVIDER=runpod_serverless`
  - `RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3`
- `CHAT_SYSTEM_URL` fixed in Vercel to use the bare chat-service base URL, not a URL ending in `/api/chat`.
- Cloudflare R2 CORS policy set for direct browser uploads.

## Recommended next task

Start with the smallest high-impact QA blocker:

Fix profile edit 400 errors by normalizing empty date fields from `""` to `null` or omitting them before the PUT request.

Why:

- It is critical and user-facing.
- It blocks both Family Tree editing and Relative Profile editing.
- It should be smaller and safer than infrastructure or RunPod worker work.
- It is explicitly documented in `qa_validation_report.md` with reproduction steps.

After that:

1. Fix sign-out callback URL.
2. Add shared confirmation dialog before destructive relative deletion.
3. Run targeted validation.
4. Continue with RunPod worker or follow-up product QA/design work.
