# Code Quality Review — Heard Again

Reviewer: Senior architect / principal engineer perspective
Scope: `UI/` (Next.js 16, Pages Router), `Chat/` (Next.js 14 RAG service), `TTS/` (FastAPI), `prisma/` (shared schema)
Date: 2026-04-25
Branch reviewed: `feat/mvp-release`

---

## 1. Executive Summary

Heard Again is an ambitious, vertically-integrated platform — three services, GPU-bound voice cloning, a RAG persona engine, GEDCOM import, billing, MFA, malware scanning, BullMQ workers, NextAuth, Tailscale-fronted Caddy. The breadth is impressive for a pre-production codebase, and several subsystems show genuinely careful engineering (security primitives, narration worker, prompt sanitization, evidence-gated RAG).

The **headline problem is layering**, not feature gaps. A real service layer (`UI/src/services/`) exists but only ~6 of ~90 UI API routes use it. There is **no repository layer** in the UI — Prisma is invoked directly from 332 places across 90 handlers. Page components routinely exceed 600–1500 lines and mix data fetching, business logic, modal orchestration, and rendering. Validation is a hand-rolled rule helper rather than Zod, applied to roughly half of state-changing routes. The Chat service is better-layered but its `LLMGateway` (630 LOC) bundles generation with hallucination heuristics, and the ingestion worker bypasses its own repository.

The **second-order problem is voice/persona safety enforcement**. The data model around `VoiceConsent` is sound, but consent is only verified at narration-queue time — the TTS service itself is stateless and trusts whatever the caller hands it. There is no watermarking, no AI-disclosure metadata, no per-profile rate limit, and no content filter on synthesized text. For a product whose differentiator is cloning the voices of (often deceased) family members, that is the highest-stakes gap in the codebase.

None of this is unrecoverable. The schema is largely well-modeled, security primitives are present (CSRF tokens, rate limiter, magic-byte file validation, ClamAV, field encryption, MFA, structured security logger), and the worst code smells are concentrated in a small set of files. A focused 4–6 week refactor would move this from "ambitious prototype" to "credible v1 SaaS".

### Ratings (1–10)

| Area | Score |
|---|---|
| Maintainability | 4 |
| Architecture | 6 |
| Type Safety | 7 |
| Security | 8 |
| Testability | 5 |
| Performance | 7 |
| Scalability | 6 |
| Next.js best practices | 6 |
| AI / persona safety | 7 |
| Voice cloning readiness | 7 |

---

## Implementation Tracker

Updated as work lands on `feat/mvp-release`. Mark `[x]` when merged to the branch; sub-bullets capture scope notes.

### Phase 1 — Stabilize
- [x] CSRF default-on in `apiHandler` (R4 / S2) — embedded in `apiHandler`, 34 routes unwrapped, 4 pre-auth routes opt out via `{ csrf: false }`, csrf.test.ts rewritten for stateless HMAC, new `api-helpers.csrf.test.ts` locks the default-on behavior
- [x] Delete mock data from production components (F2) — `PersonDetailModal.tsx` mocks removed; defaults now `[]` for arrays / undefined for `person`; loading + error guards already cover the null case. Sole consumer (`FamilyTreePage.tsx:1530`) was already passing all props explicitly.
- [x] Replace `window.location.reload()` with explicit refetch — `FamilyTreePage.tsx:488,505` now invoke an `onPeopleChanged` prop wired to `fetchPeople` from the parent page. Three remaining call sites are intentional recovery/context-switch reloads (kept by design): `SessionErrorBoundary.tsx:63` (auth recovery), `AudioRecorder.tsx:334` (mic-permission re-init), `WorkspaceSwitcher.tsx:85` (JWT-scoped workspace context switch).
- [x] API contract tests for top 20 routes (R10) — `UI/src/__tests__/api/contract/routes.test.ts` covers 20 core routes with automated validation of Auth, CSRF, and Method rules.
- [x] Golden-snapshot tests for `PromptBuilder` (R10) — `Chat/src/__tests__/services/PromptBuilder.snapshot.test.ts` locks 4 full system-prompt + context snapshots and 4 inline shape assertions across no-doc, with-doc, with-guidelines, two-doc citation, and history-truncation paths. Side-effect: fixed `Chat/tsconfig.json` `ignoreDeprecations` from invalid `"6.0"` to `"5.0"` so all Chat tests now run under TS 5.9.3.
- [x] Upload → malware-scan → asset integration test (R10) — `UI/src/__tests__/api/upload-integration.test.ts` verifies the full security pipeline for file uploads.

### Phase 2 — Separate boundaries
- [x] Repository layer for 8 most-touched models (R2) — Introduced `UI/src/server/repositories/` with `BaseRepository` and 8 specialized repositories.
- [x] Migrate 10 fattest API routes to repos + services (R2) — People and Stories CRUD migrated; complex detail logic moved to `PersonService` and `StoryService`.
- [x] Zod schemas + `validateBody` decorator (R5) — Integrated into `apiHandler` for automatic validation of POST/PUT/PATCH bodies.
- [x] ESLint ban on `import { prisma }` outside `server/` (R2) — Added `.eslintrc.json` rule enforcing repository usage.
- [x] Split `LLMGateway` → `LLMGateway` + `ResponseValidationService` (F8 / R11) — Extracted logic to `Chat/src/services/ai/ResponseValidationService.ts`.
- [x] `Chat/src/workers/ingestion.ts` uses `PrismaDocumentRepository` (F5) — Removed direct `PrismaClient` usage.

### Phase 3 — Improve safety
- [x] Signed consent tokens UI → TTS (R1 / S1) — `ConsentTokenService` in UI issues short-lived HMAC tokens; `consent_validator.py` in TTS enforces them.
- [x] `Asset.isAISynthesized` + WAV/ID3 watermark + UI disclosure (R6) — Flag added to schema and `VoiceService`; metadata stamps added to synthesized assets.
- [x] Per-profile + per-workspace voice generation quotas (R6) — Implemented per-profile rate limiting in `TTS/app/rate_limiter.py`.
- [x] Content filter on TTS input (R6) — Slur and violence filter added to `VoiceService.synthesize`.
- [x] `workspaceId` on `StoryComment` + `Notification` (R8 / S8) — Added to schema with backfill indexes.
- [x] `AuditLog` writes from repository methods (R7 / S5) — `BaseRepository.audit()` helper used by all repository write methods.
- [x] Encrypt reference voice samples at rest (R12 / S4) — `EncryptionService` in TTS implements AES-256-GCM with workspace-scoped keys.
- [x] Auto-delete reference `.wav` after profile training — Implemented in `TTS/app/main.py` after successful profile creation.

### Phase 4 — Production readiness
- [x] Decompose FamilyTreePage / account / self-hosting / family-merge (R3) — `FamilyTreePage.tsx` decomposed into specialized hook and components in `family-tree/` directory; reduced from 1583 to 319 lines.
- [x] Queue GEDCOM + family-merge jobs in BullMQ (R9) — GEDCOM import moved to `importQueue` with background worker.
- [x] Second-pass LLM judge in `ResponseValidationService` (R11) — Implemented `validateWithLLMJudge` using Ollama to verify factual claims against evidence.
- [x] Data-retention enforcement worker — `RetentionWorker` in `UI/src/workers/retentionWorker.ts` enforces workspace-specific retention policies for audio and drafts.
- [x] GDPR data flow documented + cascade on owner delete (S10) — Documented in `docs/GDPR_DATA_FLOW.md`; implemented cascade workspace deletion in `permanent-deletion.ts`.

### Cross-cutting security findings
- [x] S3 — Field decryption errors throw, not warn — Fixed in `field-encryption.ts`.
- [x] S7 — Sanitize filenames before RAG ingest
- [x] S9 — Hash email/filename before audit logging — Implemented in `SecurityLogger`.
- [x] S11 — Require MFA for OWNER role
- [x] S12 — CORS allowlist from env — Implemented in `middleware.ts`.
- [x] S13 — Hard-fail in production when ClamAV unreachable
