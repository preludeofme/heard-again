# Heard Again Decisions

Last updated: 2026-05-20 22:10:40 CDT

This file records stable project decisions and conventions that future sessions should preserve.

## Architecture decisions

### Multi-service repository

Heard Again remains organized as a multi-service repository:

- `UI/` for the main web product.
- `Chat/` for family-history chat/RAG/persona functionality.
- `TTS/` for voice synthesis.
- `prisma/` for the shared database schema.
- `Scripts/` for orchestration and development operations.

### UI framework

The UI uses Next.js Pages Router with React and Material UI.

Do not migrate to App Router as part of ordinary feature work. Follow existing Pages Router patterns unless a migration is explicitly requested.

### Contextual UI pattern

`SelectedFamilyMemberContext` is a central application pattern.

Before changing profile, family tree, story, media, collection, or dashboard behavior, check whether the component or API call depends on the active selected family member.

### Shared Prisma schema

The shared Prisma schema lives at:

`prisma/schema.prisma`

UI and Chat both rely on this schema. Schema edits require Prisma client regeneration.

### Security primitives location

Security-related primitives are centralized under:

`UI/src/lib/security/`

Use this area for CSRF, rate limiting, MFA, validation/security headers, and related behavior instead of scattering independent implementations.

### Storage abstraction

Storage is provider-based and configured through environment variables. Prefer using existing abstractions in:

`UI/src/lib/storage/`

Do not hard-code local filesystem, S3, R2, or GCP assumptions into product code unless a provider implementation specifically owns that logic.

### Trigger.dev migration

Narration/background task work has moved toward Trigger.dev.

The root Trigger.dev config is:

`trigger.config.ts`

Current task directory:

`UI/src/trigger`

The config uses `syncEnvVars` to forward DB, storage, and TTS/RunPod env vars. Future Trigger.dev task work should respect this pattern and avoid duplicating secret configuration in code.

### Local Trigger.dev endpoint

Local Trigger.dev server/dashboard/API is expected at:

`http://localhost:3030`

Local app config should use:

`TRIGGER_API_URL=http://localhost:3030`

### TTS provider direction

Production TTS is intended to use RunPod serverless via:

- `TTS_PROVIDER=runpod_serverless`
- `RUNPOD_TTS_ENDPOINT_ID`
- `RUNPOD_API_KEY`

The TypeScript provider exists, but a RunPod Python worker is documented as missing.

## Workflow decisions

### Project memory docs

Future sessions should update these files when meaningful project state changes:

- `docs/PROJECT_STATUS.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/TASK_LOG.md`

Use these files for resumable project state instead of relying only on chat history.

### Validation preference

Prefer targeted validation over broad, slow checks while iterating.

Useful commands:

- Root typecheck: `npm run type-check`
- UI typecheck: `npm --workspace UI run typecheck`
- UI tests: `npm --workspace UI run test`
- Chat typecheck: `npm --workspace Chat run type-check`
- Chat tests: `npm --workspace Chat run test`
- Root verification script: `npm run verify`

### Lint status

UI `npm run lint` currently prints a skip message because Next.js 16 removed `next lint`. Do not treat the lint script as meaningful validation until ESLint flat config is restored.

### Destructive actions

User-facing destructive actions should require confirmation, preferably through the shared `ConfirmDialog` pattern already referenced by QA docs.

This is especially important for deleting relatives/person records, stories, family spaces, and media.

## Deployment / environment decisions

### Vercel CHAT_SYSTEM_URL format

`CHAT_SYSTEM_URL` should be the bare base URL of the Chat service.

It should not include `/api/chat`, because UI proxy routes append their own API paths.

Status: completed in Vercel per Ryan on 2026-05-20.

### Direct-to-R2 upload flow

Voice uploads are intended to use a direct-to-R2 async flow:

1. Client requests presigned upload URL.
2. Browser uploads directly to R2.
3. Server submits an async RunPod job using the uploaded R2 object URL.
4. Client polls upload/job status.

Cloudflare R2 CORS must allow the browser PUT step.

Status: completed per Ryan on 2026-05-20.

## Open decisions / unresolved questions

- Exact location and structure for the missing RunPod worker package still needs implementation design.
- Whether `download_audio` remains necessary in serverless/R2 mode or should only be kept for legacy compatibility.
- Whether QA blockers should all be fixed before starting the RunPod worker, or whether deployment priorities should override that sequence.
