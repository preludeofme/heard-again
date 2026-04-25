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
| Architecture | 5 |
| Type Safety | 6 |
| Security | 6 |
| Testability | 3 |
| Performance | 6 |
| Scalability | 5 |
| Next.js best practices | 5 |
| AI / persona safety | 6 |
| Voice cloning readiness | 4 |

---

## 2. Top Risks (priority order)

### R1 — Voice synthesis bypasses consent at the TTS boundary
- **Severity:** Critical
- **Location:** `TTS/app/main.py:777-885` (`/synthesize`); `UI/src/workers/narrationWorker.ts:69-83` is currently the *only* place consent is checked.
- **Why it matters:** TTS is stateless and has no view of `VoiceConsent`. Any caller with a workspace token and a profile ID can generate audio from a cloned voice — including after consent is revoked, since revocation does not cancel queued jobs and cannot reach in-flight TTS calls.
- **Fix:** Issue short-lived signed consent tokens from UI → TTS that encode `(workspaceId, profileId, consentId, exp)`. TTS validates signature and expiry on every `/synthesize` call. Add a revocation handler that (a) sets `revokedAt`, (b) cancels all open `VoiceGenerationJob` rows for that consent, (c) flushes any cached tokens.

### R2 — No repository layer; 332 direct Prisma calls across 90 API routes
- **Severity:** High
- **Location:** Pervasive in `UI/src/pages/api/**`
- **Why it matters:** Authorization, workspace scoping, and N+1 prevention are re-implemented in every route. When a model changes (e.g. soft-delete on `Story`), every consumer must be audited.
- **Fix:** Introduce `UI/src/server/repositories/` per aggregate (`PersonRepository`, `StoryRepository`, `VoiceProfileRepository`, etc.). Make `prisma` a singleton injected only into repositories. Lint-ban `import { prisma }` outside `server/`.

### R3 — Page components are doing everything
- **Severity:** High
- **Location:** `UI/src/components/pages/FamilyTreePage.tsx` (1583 LOC), `UI/src/components/modals/PersonDetailModal.tsx` (862), `UI/src/pages/profile/[id].tsx` (858), and ~10 others over 500 LOC.
- **Why it matters:** These files mix `useState` farms (16+ in `FamilyTreePage.tsx:359-391`), inline `fetch` in click handlers, `window.location.reload()` (`FamilyTreePage.tsx:488,505`) for "refresh", and hardcoded mock data left in production code (`PersonDetailModal.tsx:111-200`). Any change risks a regression in an unrelated tab.
- **Fix:** Extract per-feature hooks (`useFamilyTreeData`, `useFamilyTreeCanvas`, `usePersonDetail`), promote modals to feature folders, replace `window.location.reload()` with SWR/React Query invalidation.

### R4 — CSRF protection is opt-in and inconsistently applied
- **Severity:** High
- **Location:** 74 of 111 UI API route files use `withCSRFProtection`. Several state-changing routes (e.g. `UI/src/pages/api/billing/*`, `UI/src/pages/api/family-merge/*`, `UI/src/pages/api/auth/complete-onboarding.ts`, `UI/src/pages/api/auth/forgot-password.ts`) do not.
- **Why it matters:** A logged-in user navigating a hostile page is an attacker. Verified safe: `voice/consent/[id].ts` (PUT), `voice/upload-sample.ts`, `assets/upload.ts`. Verified missing: see list above.
- **Fix:** Move CSRF enforcement into `apiHandler` so any non-`GET`/`HEAD`/`OPTIONS` method is gated by default; allow explicit opt-out for webhooks (Stripe etc.). Audit the remaining 37 routes.

### R5 — Validation is hand-rolled and applied to ~half of mutation routes
- **Severity:** High
- **Location:** `UI/src/lib/validation.ts:10-31` (custom `validate(data, rules)`); 73 routes touch `req.body` directly without schema validation. Only ~6 Zod usages in the API layer.
- **Why it matters:** GEDCOM imports, family-merge analyze/execute, persona instructions, and several voice routes accept free-form input. Zero schema coverage means malformed input flows into Prisma queries and the LLM prompt builder.
- **Fix:** Standardize on Zod, store schemas under `UI/src/schemas/`, wrap every handler with a `validateBody(schema)` decorator, and emit OpenAPI from schemas as a free side-effect.

### R6 — Voice cloning has no abuse controls
- **Severity:** High
- **Location:** `TTS/app/main.py:777-845` (no content filter, no per-profile quota); `TTS/app/rate_limiter.py:175-180` (100 syntheses / 15 min per user); generated `Asset` rows lack an `isAISynthesized` flag in `prisma/schema.prisma`.
- **Why it matters:** Today, an EDITOR-role user can synthesize unlimited "grandma says X" audio with no filter on X, no watermark, no audit trail to the voice owner, no per-profile cap. This is the single biggest reputational risk in the product.
- **Fix:** Add `isAISynthesized` boolean + `synthesisAuditLog` to schema; per-profile and per-workspace quotas; content-filter pass on `req.text` (slurs, named-person impersonation prompts); embed inaudible watermark or at minimum stamp WAV `INFO` chunk + ID3 with "AI-generated by Heard Again, profile <id>"; add disclosure banner when audio is shared.

### R7 — `AuditLog` exists but is written from one endpoint
- **Severity:** High
- **Location:** `prisma/schema.prisma:616-636`; only writer is `UI/src/pages/api/privacy/retention.ts:123-138`.
- **Why it matters:** GDPR Art. 30 ("records of processing"), CCPA, and any future SOC 2 attempt require a real audit trail. The infrastructure is built; it just isn't called.
- **Fix:** Emit audit entries from repository write methods (when introduced — see R2). Cover at minimum: voice profile create/delete, consent grant/revoke, person delete, story delete, member add/remove, role change.

### R8 — Two models bypass workspace isolation
- **Severity:** Medium-High
- **Location:** `prisma/schema.prisma` — `StoryComment` (lines 423-438) and `Notification` (lines 810-823) lack `workspaceId`.
- **Why it matters:** Authorization currently relies on parent-row joins; any handler that forgets the join leaks across workspaces.
- **Fix:** Add `workspaceId` columns + indexes; backfill from `Story.workspaceId` / `User.defaultWorkspaceId`; make it required in subsequent migration.

### R9 — Long-running jobs other than narration run inline
- **Severity:** Medium
- **Location:** `UI/src/pages/api/import/gedcom.ts` (584 LOC, parses + writes inline); `UI/src/pages/api/family-merge/analyze.ts` (368 LOC); `UI/src/pages/api/family-merge/execute.ts`.
- **Why it matters:** A large GEDCOM (10k people) will exceed the API timeout and is unrecoverable mid-write. The narration worker (`UI/src/workers/narrationWorker.ts`) shows the right pattern; extend it.
- **Fix:** Queue these in BullMQ with a `Job` table-backed status surface, just like narration.

### R10 — Test coverage is too low to refactor safely
- **Severity:** Medium
- **Location:** `Chat/src/__tests__/` has ~5 files for ~70 source files. UI has `__tests__` directories but no end-to-end coverage of API auth/authz, upload, or persona flows. E2E suite (`/e2e/`) is sparse.
- **Why it matters:** All recommendations below assume a safety net. Without tests, the refactor itself becomes a regression source.
- **Fix:** Before touching layering, lock in API contract tests for the top 20 routes, integration tests for upload + voice + consent, and `PromptBuilder` golden-snapshot tests.

### R11 — Hallucination detection is regex-based
- **Severity:** Medium
- **Location:** `Chat/src/services/llm/LLMGateway.ts:292-430`.
- **Why it matters:** Pattern matching on "I think", "my wife was named X" catches naive cases and produces both false positives (legitimate hedging is flagged) and false negatives (any paraphrase passes).
- **Fix:** Extract validation to a `ResponseValidationService`; add second-pass LLM judge that scores claims against retrieved evidence; track precision/recall in `Chat/src/services/eval/EvaluationHarness.ts`.

### R12 — Reference voice samples stored as plaintext on disk
- **Severity:** Medium
- **Location:** `TTS/app/main.py:237-241` and `:374-382` write `.wav` and `.pt` profile files to `REFERENCE_AUDIO_DIR` / `VOICE_PROFILES_DIR` per workspace, with no application-level encryption and no per-file ACL.
- **Why it matters:** Voice biometrics are sensitive. A disk snapshot, backup, or container escape exposes every cloned voice in the system. `.pt` files are usable in any Qwen3-TTS install.
- **Fix:** Encrypt at rest with workspace-scoped keys (reuse `UI/src/lib/security/field-encryption.ts` pattern); auto-delete reference `.wav` after successful training; never serve `.pt` over HTTP — only via authenticated `/synthesize`.

---

## 3. File and Method Size Audit

### Files exceeding the 300-line guideline

| File | Approx Lines | Issue | Recommendation |
|---|---:|---|---|
| `UI/src/components/pages/FamilyTreePage.tsx` | 1583 | Tree data + canvas/zoom + search overlay + 3 modal harnesses + 16 useStates + inline fetches | Split into `useFamilyTreeData`, `useFamilyTreeCanvas`, `FamilyTreeSearchOverlay`, `FamilyMemberRow`; keep page <300 LOC |
| `Chat/src/services/chat/ChatService.ts` | 994 | Orchestrates retrieval, prompt build, LLM call, streaming, validation, persistence, citation extraction | Split into `ChatOrchestrator`, `ChatStreamPipeline`, `MessagePersistenceService` |
| `UI/src/components/modals/PersonDetailModal.tsx` | 862 | Mock data hardcoded (lines 111-200), 8 tabs in one file, no validation | Extract per-tab subcomponents under `features/persons/PersonDetail/`; remove mocks |
| `UI/src/pages/profile/[id].tsx` | 858 | Inline `Promise.all` fetches, manual sort, in-component formatting | Move to `usePersonProfile()` hook + presentational component |
| `UI/src/components/modals/PersonModal.tsx` | 749 | Relationship CRUD + person CRUD + raw `useState` form | Split into `PersonForm` (RHF + Zod) and `RelationshipManager`; one file each |
| `UI/src/pages/family-merge.tsx` | 740 | Wizard state + diff rendering + per-row conflict resolver | Extract `useFamilyMergeWizard`, render steps as separate components |
| `UI/src/components/pages/StoriesPage.tsx` | 723 | 15+ `useState` for filters + modal + pagination | Extract `useStoryListFilters`, push pagination into URL state |
| `UI/src/lib/security/malware-scanner.ts` | 719 | Two scanner implementations + heuristics + EICAR + entropy + zip-bomb in one file | Split: `ClamAvScanner.ts`, `BasicScanner.ts`, `MalwareScannerFactory.ts`, `heuristics/` |
| `UI/src/pages/account.tsx` | 714 | Profile + security + billing + sessions tabs all inline | One file per tab under `features/account/` |
| `UI/src/pages/self-hosting.tsx` | 695 | Setup wizard + status + diagnostics | Same: split into `features/self-hosting/` |
| `UI/src/pages/family-tree.tsx` | 675 | Page-level wrapper duplicating logic in `FamilyTreePage.tsx` | Investigate duplication; collapse if redundant |
| `UI/src/pages/tunnel-setup.tsx` | 672 | Wizard + status polling + secrets management | Extract `useTunnelSetup` hook |
| `Chat/src/services/llm/LLMGateway.ts` | 630 | Generation + validation + hallucination heuristics + provider switching | Split: `LLMGateway` (provider only), `ResponseValidationService`, `HallucinationDetector` |
| `UI/src/controllers/useChatConversation.ts` | 626 | Speech-recognition wiring + fetch + streaming + state | Split: `useSpeechRecognition`, `useConversationStream`, view-model |
| `UI/src/components/audio/AudioRecorder.tsx` | 618 | MediaRecorder + waveform + UI + retry | Extract `useMediaRecorder` and `WaveformCanvas` |
| `UI/src/pages/api/import/gedcom.ts` | 584 | Parsing + validation + writes + transactions in one handler | Move parsing to `server/services/gedcom/GedcomParser.ts`; queue write phase |
| `UI/src/components/audio/VoiceTrainingModal.tsx` | 566 | Consent + recording + preview + submit | Split into wizard steps |
| `Chat/src/services/persona/StyleExtractor.ts` | 528 | Multi-step style analysis | Split per dimension (vocab / tone / formality) |
| `UI/src/pages/api/timeline/index.ts` | 514 | 6 parallel queries + transformation + pagination | Move to `server/services/TimelineService.ts` |
| `Chat/src/services/chat/PromptBuilder.ts` | 515 | OK — centralization is the point. Still consider splitting per template kind |
| `UI/src/workers/narrationWorker.ts` | 480 | Best-of-class in this repo, but multi-phase logic could be extracted | Light split: `phases/load.ts`, `phases/synthesize.ts`, `phases/persist.ts` |

### Functions / methods exceeding ~75 lines

| Function | File | Approx Lines | Recommendation |
|---|---|---:|---|
| `FamilyTreePage` (default export) | `UI/src/components/pages/FamilyTreePage.tsx` | ~1500 | Decompose; this is the root of the file-size problem |
| `ChatService.handleStreamingChat` | `Chat/src/services/chat/ChatService.ts:~580-700` | ~120 | Extract pipeline stages |
| `LLMGateway.validateResponse` | `Chat/src/services/llm/LLMGateway.ts:214-388` | ~175 | Move to `ResponseValidationService` |
| `handleAddInstruction` | `Chat/src/pages/api/persona/instructions.ts:173-216` | ~45 (with siblings = ~200) | Replace 4-way switch with `category → field` map |
| `narrationWorker` job processor | `UI/src/workers/narrationWorker.ts:~80-380` | ~300 | Extract per-phase functions |
| GEDCOM import handler | `UI/src/pages/api/import/gedcom.ts` | ~500 | Move 90% to a service; handler should enqueue |
| `family-merge/analyze` handler | `UI/src/pages/api/family-merge/analyze.ts` | ~330 | Move matching to `server/services/family-merge/MatchEngine.ts` |
| `useChatConversation` | `UI/src/controllers/useChatConversation.ts` | ~600 | Decompose into 3-4 hooks |

---

## 4. Architecture Assessment

### UI layer
Pages Router with co-located components in `components/pages/` is fine, but the layering inside each page is missing. Components do data fetching with `useEffect` + raw `fetch`, manage many flag states, and call `window.location.reload()` to invalidate. There is no client-side data layer (SWR, React Query, RTK Query) — verdict: **needs work**.

### API / server layer
A consistent `apiHandler` wrapper (`UI/src/lib/api-helpers.ts:168-204`) provides standardized success/error envelopes and Prisma-error translation — this is a real strength. Auth helpers (`getAuthUserWithWorkspace`, `requireWorkspaceRole`) are used in 288 places and workspace scoping is generally present. But: validation is partial, CSRF is opt-in, services are bypassed, repositories don't exist. Verdict: **good plumbing, weak boundaries**.

### Service layer
`UI/src/services/` contains real domain services (`PersonService`, `RelationshipService`, `StoryService`, `VoiceService`, etc.) that take `PrismaClient` as an injected dependency. These are correctly server-only (`import type` is erased at compile time), but only ~6 of 90 routes consume them. Verdict: **built, not adopted**.

### Database layer
Prisma schema is generally well-modeled (33 models, consistent naming, broad cascade discipline, decent index coverage). Critical gaps: no repository layer in UI, `StoryComment` and `Notification` lack `workspaceId`, soft-delete only on `Document`, `AuditLog` writes from one endpoint, `VoiceConsent` lacks `updatedAt` and a uniqueness constraint. Verdict: **schema is solid, access pattern is not**.

### AI / RAG layer (Chat)
This is the best-architected part of the codebase. Prompt construction is centralized in `Chat/src/services/chat/PromptBuilder.ts:54-107`, sanitization is real (`sanitizeUserInput` strips control chars, blocks injection prefixes, caps at 10KB), and `EvidenceGate.toCitations` produces source attribution. Workspace + `personId` isolation is consistently enforced in `RetrievalService.ts:28-62` and `VectorSearch.ts:321-337`. Weaknesses: `LLMGateway` is overstuffed, `DatabasePersonaRepository` calls Prisma directly, ingestion worker bypasses its own repository (`Chat/src/workers/ingestion.ts:284-363`). Verdict: **strong core, minor leaks**.

### Voice layer
Cleanly separated in `TTS/` as a Python service. UI integration via `UI/src/lib/tts-client.ts`, narration via `UI/src/workers/narrationWorker.ts`, profile management in `UI/src/pages/api/voice/`. The pieces are in the right places. The problem is **trust boundaries**: TTS trusts whatever caller it gets and has no view of consent. Verdict: **right shape, wrong boundary enforcement**.

### Storage layer
`UI/src/lib/storage/` provides a provider-based abstraction (local / S3 / GCP) — good. File optimizer and validator pipeline (`UI/src/lib/file-optimizer/`, `UI/src/lib/security/file-validator.ts`) is properly defense-in-depth. Verdict: **good**.

### Shared types / schemas
`UI/src/contracts/index.ts` (375 LOC) defines API contract enums and DTOs reasonably well. Mappers (`UI/src/mappers/`) exist but are underused — most components consume raw API data. Chat duplicates some types in `Chat/src/types/`. There is no shared `packages/` workspace. Verdict: **inconsistent adoption**.

---

## 5. Spaghetti Code Findings

### F1 — `FamilyTreePage.tsx` is doing 6 jobs in one file
- **Location:** `UI/src/components/pages/FamilyTreePage.tsx` (1583 LOC)
- **What is tangled:** Tree data fetching (lines 408-442), canvas rendering / zoom / pan (lines 532-610), search overlay (lines 1362-1527), 3 modal lifecycles (lines 359-378), 16+ `useState` calls (lines 359-391), and JSX rendering (lines 881-1583). A click handler at line 488 calls `window.location.reload()` to "refresh".
- **Why it is hard to maintain:** Any change touches the whole file. Testing is impossible without mounting a full canvas + DOM.
- **Refactor:**
  - `features/family-tree/hooks/useFamilyTreeData.ts` — fetching + cache invalidation
  - `features/family-tree/hooks/useFamilyTreeCanvas.ts` — pan/zoom/connector math
  - `features/family-tree/components/FamilyTreeSearch.tsx`
  - `features/family-tree/components/GenerationRow.tsx`
  - Page becomes <200 LOC composing these

### F2 — Modals carry mock data into production
- **Location:** `UI/src/components/modals/PersonDetailModal.tsx:111-200`
- **What is tangled:** 8 mock arrays declared at module scope and used as default prop values (`person = mockPerson`).
- **Why it matters:** Easy for a caller to forget to pass props and silently render fake data; pollutes bundle.
- **Refactor:** Delete the mocks; require props; move fixtures to `__tests__/fixtures/person.ts`.

### F3 — Controllers are not view-models, they are page logic
- **Location:** `UI/src/controllers/useChatConversation.ts:49-187`, `UI/src/controllers/useVoiceTraining.ts`, `UI/src/controllers/useVoiceLabController.ts`
- **What is tangled:** Browser-API wiring (Web Speech, MediaRecorder), HTTP calls, retry logic, and React state in one hook.
- **Refactor:** A controller hook should compose smaller hooks. E.g. split `useChatConversation` into `useSpeechRecognition`, `useConversationStream`, `useConversationHistory`, then expose a thin `useChatConversation` that wires them.

### F4 — API routes own the algorithm
- **Location:** `UI/src/pages/api/import/gedcom.ts` (parsing), `UI/src/pages/api/family-merge/analyze.ts` (matching), `UI/src/pages/api/timeline/index.ts` (aggregation)
- **What is tangled:** A handler is supposed to: validate → authorize → delegate → respond. These do all four plus the algorithm. Consequence: the algorithm cannot be tested without an HTTP harness, and reused only by copy-paste.
- **Refactor:** Move to `UI/src/server/services/{gedcom,family-merge,timeline}/`. Handlers become 30 lines.

### F5 — Worker bypasses its own repository
- **Location:** `Chat/src/workers/ingestion.ts:284-363`
- **What is tangled:** The worker `require()`s `PrismaClient` and updates `document` directly while `PrismaDocumentRepository` is sitting next door. Same logic now exists in two places.
- **Refactor:** Inject the repository; delete the inline Prisma usage.

### F6 — Fat per-aggregate API endpoint pattern
- **Location:** `Chat/src/pages/api/persona/instructions.ts` (327 LOC) — GET/POST/PUT/DELETE all in one file with re-implemented validation in each handler and a 4-way `switch` over instruction category (lines 173-216).
- **What is tangled:** Validation, mapping, persistence, all per-method.
- **Refactor:** `categoryToField` map + `InstructionService` + per-method handlers that are <40 LOC each.

### F7 — Duplication between `pages/family-tree.tsx` (675) and `components/pages/FamilyTreePage.tsx` (1583)
- **Location:** Above two files
- **What is tangled:** Possible duplicated state/handlers between page wrapper and component. Worth a focused diff before refactor.

### F8 — `LLMGateway` is two services in one
- **Location:** `Chat/src/services/llm/LLMGateway.ts` (630 LOC)
- **What is tangled:** Lines 45-194 implement provider abstraction + fallback. Lines 214-430 implement response validation + hallucination heuristics. Two separate concerns, two separate change frequencies.
- **Refactor:** `LLMGateway` (provider/fallback only) and `ResponseValidationService` (claims, citations, hedging detection).

---

## 6. Recommended Target Architecture

This proposal preserves Pages Router (no migration to App Router required) and aligns with the user's CLAUDE.md feature-folder guidance.

```
UI/
  src/
    pages/                    # Next.js routing only — thin
      api/                    # handlers ≤ 60 LOC, delegate to server/
    features/                 # by-domain, not by-file-type
      family-members/
        components/
        hooks/
        types.ts
      family-tree/
      memories/               # stories, comments, favorites
      personas/
      voice/
        components/
        hooks/
      documents/
      auth/
      account/
      billing/
      family-merge/
      tunnel/
      onboarding/
    server/                   # server-only — never imported from features/
      services/               # PersonService, StoryService, VoiceService, ...
      repositories/           # PersonRepo, StoryRepo, VoiceProfileRepo, AuditLogRepo
      jobs/                   # narrationWorker, ingestionWorker, gedcomWorker
      ai/
      rag/
      voice/                  # TTS client, signed-token issuer
      storage/
      gedcom/
      family-merge/
    lib/                      # cross-cutting: api-helpers, validation, logger, prisma
    components/               # truly shared, presentational only
    schemas/                  # Zod schemas per feature
    types/                    # shared domain types
    contracts/                # API DTOs
    hooks/                    # truly shared hooks
    middleware.ts
Chat/
  src/
    server/
      services/               # ChatService split: orchestrator + pipeline + persistence
      repositories/
      ai/                     # LLMGateway, ResponseValidationService, HallucinationDetector
      rag/                    # RetrievalService, VectorSearch, EvidenceGate
      personas/
      voice/                  # VoiceIntegrationService
      jobs/                   # ingestion worker
    pages/api/                # handlers ≤ 60 LOC
    schemas/
    types/
TTS/
  app/
    api/
    services/
      consent/                # signed-token validator
      content_filter/
      synthesis/
      profile/
    middleware/
    storage/                  # encrypted at-rest
prisma/
  schema.prisma
  migrations/
packages/
  shared-types/               # types reused across UI + Chat
  prompt-templates/           # versioned, tagged, importable from Chat
```

Rules:
- `features/**` may import from `lib`, `components`, `schemas`, `contracts`, `hooks` only.
- `server/**` is the only place Prisma is imported. Enforce with ESLint `no-restricted-imports`.
- Every API route is `pages/api/<feature>/<route>.ts` and is ≤ 60 LOC.

---

## 7. Refactor Plan

### Phase 1 — Stabilize (1–2 weeks)
- Lock in coverage on the riskiest paths before touching layering:
  - API contract tests for the top 20 routes (auth, voice, upload, consent, persona, billing webhooks).
  - Golden-snapshot tests for `Chat/src/services/chat/PromptBuilder.ts`.
  - Integration test for the full upload → malware-scan → asset path.
- Make CSRF default-on inside `apiHandler`; whitelist webhooks only.
- Delete `mockPerson` / `mockStories` etc. from production component files (`PersonDetailModal.tsx:111-200` and similar).
- Replace `window.location.reload()` calls with explicit refetch (introduce React Query or SWR — pick one).

### Phase 2 — Separate boundaries (2–3 weeks)
- Stand up `UI/src/server/repositories/` for the 8 most-touched models (Person, Story, Asset, Document, VoiceProfile, VoiceConsent, PersonaProfile, Workspace).
- Migrate the 10 fattest API routes to use repositories + services.
- Migrate validation to Zod schemas under `UI/src/schemas/` for those 10 routes; introduce `validateBody(schema)` decorator in `apiHandler`.
- Add ESLint rule banning `import { prisma }` outside `UI/src/server/`.
- Split `LLMGateway` into `LLMGateway` + `ResponseValidationService`.
- Make `Chat/src/workers/ingestion.ts` use `PrismaDocumentRepository`.

### Phase 3 — Improve safety and testing (2 weeks)
- Implement signed consent tokens issued by UI, validated by TTS (R1).
- Add `isAISynthesized` to `Asset` schema; stamp WAV/ID3 metadata; add disclosure surface in UI.
- Add per-profile and per-workspace voice generation quotas; tighten rate limit for `/synthesize` to a sane per-profile cap (R6).
- Implement content filter pass on TTS input.
- Add `workspaceId` to `StoryComment` and `Notification`; backfill + require (R8).
- Wire `AuditLog` writes from repository methods (R7).
- Encrypt reference voice samples at rest using existing `field-encryption.ts` keying (R12).
- Auto-delete reference `.wav` after profile is trained.

### Phase 4 — Production readiness (2 weeks)
- Move FamilyTreePage, account.tsx, self-hosting.tsx, family-merge.tsx into `features/` decomposition.
- Queue GEDCOM imports and family-merge jobs in BullMQ; surface progress via the existing job pattern from `narrationWorker`.
- Add ResponseValidation second-pass LLM judge; track precision/recall in `Chat/src/services/eval/EvaluationHarness.ts`.
- Add data-retention enforcement worker (the policies in `UI/src/pages/api/privacy/retention.ts` are advisory — make them effective).
- Document/export full GDPR data flow (currently `permanent-deletion.ts` only redacts the user, not their workspace data).

---

## 8. Concrete Code Changes Needed (in order)

1. **`UI/src/lib/api-helpers.ts`** — make CSRF + body-validation default. New surface:
   ```ts
   apiHandler({
     POST: { schema: z.object({...}), handler: async (req, res, body) => {...} }
   })
   ```
   Benefit: ends opt-in CSRF and ad-hoc validation in one move.

2. **`UI/src/server/repositories/PersonRepository.ts`** (new) — wrap all `prisma.person.*` access. Migrate `UI/src/pages/api/people/**` (the largest API-route family) first. Benefit: a single chokepoint for workspace scoping + audit logging.

3. **`TTS/app/services/consent_validator.py`** (new) — verifies HMAC-signed consent tokens issued by UI. Wire into `TTS/app/main.py:777-885`. Benefit: closes R1.

4. **`UI/src/server/services/voice/ConsentTokenService.ts`** (new) — issues short-lived signed tokens including `(workspaceId, profileId, consentId, exp)`. Replace direct `/synthesize` calls in `UI/src/workers/narrationWorker.ts` and `Chat/src/services/voice/VoiceIntegrationService.ts`.

5. **`prisma/schema.prisma`** — add:
   - `Asset.isAISynthesized Boolean @default(false)`
   - `VoiceConsent.updatedAt DateTime @updatedAt`
   - `@@unique([workspaceId, personId, voiceProfileId, consentType])` on `VoiceConsent`
   - `workspaceId` on `StoryComment` and `Notification` (with backfill migration)
   - Soft-delete (`deletedAt`) on `VoiceProfile`, `Story`, `PersonaProfile`

6. **`Chat/src/services/llm/LLMGateway.ts`** — split into `LLMGateway.ts` (provider only, ~250 LOC) and `Chat/src/server/ai/ResponseValidationService.ts` (~250 LOC). Benefit: single-responsibility, both individually testable.

7. **`Chat/src/workers/ingestion.ts`** — remove inline `new PrismaClient()` (lines 284-363); inject `PrismaDocumentRepository`. Add idempotency: hash chunk content, skip upsert if hash matches existing chunk.

8. **`UI/src/components/pages/FamilyTreePage.tsx`** — break up into `features/family-tree/`. Suggested files:
   - `features/family-tree/hooks/useFamilyTreeData.ts`
   - `features/family-tree/hooks/useFamilyTreeCanvas.ts`
   - `features/family-tree/components/FamilyTreeCanvas.tsx`
   - `features/family-tree/components/FamilyTreeSearch.tsx`
   - `features/family-tree/components/GenerationRow.tsx`
   - `features/family-tree/FamilyTreePage.tsx` (<200 LOC)

9. **`UI/src/pages/api/import/gedcom.ts`** — extract `server/services/gedcom/GedcomParser.ts`, `GedcomImportService.ts`. Handler becomes "validate file → enqueue `gedcom-import` job → return job id". Add `GedcomImportWorker` modeled on `narrationWorker`.

10. **`UI/src/components/modals/PersonDetailModal.tsx`** — delete mocks, extract per-tab subcomponents under `features/persons/PersonDetail/`. Add Zod-backed form via `react-hook-form`.

---

## 9. Testing Plan

### Unit
- `Chat/src/services/chat/PromptBuilder.ts` — golden-snapshot tests for each persona archetype + injection vectors. Already has 8 tests; add 20.
- `Chat/src/services/ai/ResponseValidationService.ts` (post-extract) — table of "claim, evidence, expected verdict".
- `UI/src/server/services/family-merge/MatchEngine.ts` — covering name matching, nicknames, dates, families.
- `UI/src/lib/security/file-validator.ts` — magic byte spoofing, extension mismatch, polyglot files.
- `UI/src/lib/security/csrf.ts` — token forge attempts, expiry, session binding.

### Integration
- Upload pipeline: temp file → magic-byte check → ClamAV → asset row → optional RAG ingest. Use ClamAV in CI (it's already a dependency).
- Voice profile training end-to-end with a fixture sample, including consent token issuance and validation.
- Narration worker: queue → render → asset persistence → cleanup of partial artifacts on failure.
- Family-merge analyze + execute on synthetic two-workspace fixtures.

### API / contract
- For every API route: 401 when unauthenticated, 403 when wrong workspace, 400 when body fails schema, 200 for happy path. Generate via a single `describeApiContract(route)` helper to keep boilerplate down.

### Component
- Each large modal as a story + interaction test (Testing Library). Particularly `PersonModal`, `VoiceTrainingModal`, `VoiceConsentModal`, `AddEditPersonModal`.

### Authorization
- `getAuthUserWithWorkspace` + `requireWorkspaceRole` matrix: VIEWER cannot mutate, EDITOR cannot manage members, ADMIN cannot delete workspace, OWNER can do everything.
- Cross-workspace isolation tests: create person in Workspace A, attempt every read/write API as a member of Workspace B — all should 404 or 403.

### AI / persona
- `RetrievalService` and `VectorSearch` tests asserting `workspace_${id}_documents` collection scoping and `personId` filter.
- "Refusal" tests: when retrieval returns 0 documents, response must be `INSUFFICIENT_EVIDENCE` envelope.
- Prompt-injection corpus run on every PR: ~40 attack strings, all must be sanitized.

### Voice cloning
- Consent revocation cancels in-flight + future generations.
- Per-profile quota exceeded returns 429.
- Content filter blocks synthesis of slur list + named-person impersonation prompts.
- Output asset has `isAISynthesized=true` and watermark/metadata present.

---

## 10. Security and Privacy Review

The bones are good. `UI/src/lib/security/` contains real implementations of CSRF, rate limiting, MFA, password policy, file validation, malware scanning, security logging, security headers, and field-level encryption. The team clearly thought about this.

The gaps are about **consistency of application** rather than missing primitives:

| # | Severity | Finding | Location | Fix |
|---|---|---|---|---|
| S1 | Critical | TTS synthesis not gated by consent | `TTS/app/main.py:777-885` | Signed consent tokens (R1) |
| S2 | High | CSRF protection opt-in; ~37 of 111 API routes lack it (some are GET, some are not) | `UI/src/pages/api/**` | Default-on in `apiHandler` (R4) |
| S3 | High | Field decryption failures silently swallowed | `UI/src/lib/security/field-encryption.ts:174-176` | Throw, don't warn |
| S4 | High | Reference voice samples plaintext at rest | `TTS/app/main.py:237-241` | Workspace-scoped at-rest encryption (R12) |
| S5 | High | `AuditLog` written by 1 endpoint | `UI/src/pages/api/privacy/retention.ts:123-138` | Wire from repositories (R7) |
| S6 | Medium | Validation hand-rolled and inconsistent | `UI/src/lib/validation.ts` + 73 routes | Zod schemas (R5) |
| S7 | Medium | Filename sent verbatim to RAG ingest — prompt-injection vector | `UI/src/pages/api/assets/upload.ts:252-293` | Send opaque ID; sanitize title server-side in Chat |
| S8 | Medium | `StoryComment` + `Notification` lack `workspaceId` | `prisma/schema.prisma:423-438, 810-823` | Add column + backfill (R8) |
| S9 | Medium | Email + filename logged in audit events without redaction | `UI/src/lib/security/security-logger.ts:283, 335` | Hash before logging |
| S10 | Medium | `permanent-deletion.ts` only redacts the User row, not workspace data they own | `UI/src/pages/api/privacy/permanent-deletion.ts` | Cascade workspace data on owner deletion or transfer ownership first |
| S11 | Medium | MFA optional even for workspace owners | `UI/src/lib/auth.ts` + schema | Require MFA for OWNER role |
| S12 | Low | CORS allowlist hardcoded to a Tailscale hostname | `UI/src/middleware.ts:6-8` | Read from env |
| S13 | Low | `BasicMalwareScanner` fallback exists in dev — confirm it cannot ship | `UI/src/lib/security/malware-scanner.ts:574-604` | Hard fail in production if ClamAV unreachable |

Privacy-specific:
- Right-to-export exists via `ExportJob` but does not include voice samples or document binaries.
- Right-to-delete on `User` does not cascade to owned workspaces — a deleted user's family data remains, attributed to a redacted user.
- Retention rules are stored but not enforced; build a `retention-worker` BullMQ job.

---

## 11. AI and Voice Cloning Safety Review

This is the area where the product is most differentiated and most exposed. Treat these recommendations as launch-blocking, not nice-to-have.

### Consent
- `VoiceConsent` schema captures the right fields (`consentType`, `allowsGeneration`, `allowsCloudProcessing`, `allowsSharing`, `recordedAt`, `revokedAt`). Good.
- Consent is checked at queue time in `UI/src/workers/narrationWorker.ts:69-83` but the TTS service itself never sees the consent record. **Required:** signed consent token from UI to TTS, validated on every `/synthesize` call.
- Revocation does not cancel queued or in-flight jobs. **Required:** revocation handler walks `VoiceGenerationJob` and cancels.
- Consent attestation text is free-form. **Recommended:** when `consentType=SELF`, require a short audio attestation recording stored as evidence.

### Access control
- Workspace scoping is consistent at the Prisma level. `voice/profiles/index.ts:19-40` correctly filters by `workspaceId`.
- However, any EDITOR-role workspace member can use any profile in the workspace. **Recommended:** add per-profile ACL (a creator can opt to restrict to themselves, or to a named list of members).

### Content filtering
- No filter exists on text submitted to `/synthesize`. **Required:** slur/violence filter + named-person impersonation detection ("say [other person's name] is [slur]"). Log all blocked attempts to `AuditLog`.

### Watermarking and disclosure
- No audio watermark, no metadata stamp, no UI disclosure that audio is AI-generated. **Required:** at minimum, write `INFO`/ID3 metadata identifying the file as AI-generated by Heard Again with profile ID and generation timestamp; add audible "this is an AI-generated voice" prefix when audio is shared outside the workspace.

### Abuse prevention
- Rate limit is generic (100 syntheses per 15 min per user). **Required:** per-profile cap (e.g. 20/day), per-workspace generation-minute quota (already modeled in `Workspace.generationMinuteQuota` — wire it up).

### Audit
- No `synthesis_log`. **Required:** every synthesis attempt — success, blocked, denied — logged to `AuditLog` with profile ID, requesting user, text length (not text content), output asset ID.

### Persona / RAG
- Strong: prompt sanitization, evidence-gated responses with citations, refusal envelope when evidence is insufficient, workspace + personId filtering at ChromaDB.
- Weak: hallucination detection is regex-based and brittle (`Chat/src/services/llm/LLMGateway.ts:292-430`). Replace with second-pass LLM judge scored against retrieved evidence.
- Missing: prompt versioning. The `releaseCandidateSpec` field exists on the compiled prompt but the underlying templates aren't tagged with versions in source control. **Recommended:** move templates to `packages/prompt-templates/v{N}/` with explicit version per persona.
- Cross-family leakage is structurally prevented by workspace scoping. Verified across `RetrievalService`, `VectorSearch`, and `PersonaService`.

### Misuse / impersonation
- Today the product can produce convincing audio of any voice in any workspace, with no watermark, no content filter, and no recipient disclosure. That is the kind of capability a regulator (or a journalist) will care about. **Treat the watermark + disclosure work as MVP scope, not a v2.**

---

## 12. Final Scorecard

| Area | Score | Notes |
|---|---:|---|
| Maintainability | 4 | 20+ files >500 LOC; controllers/services exist but bypassed |
| Architecture | 5 | Right-shaped pieces (services, contracts, workers) but boundaries unenforced |
| Type Safety | 6 | `strict: true` is on; scattered `any` in `LLMGateway`, RAG filter builder, controllers |
| Security | 6 | Strong primitives; coverage gaps in CSRF and audit; encryption-failure swallowed |
| Testability | 3 | Coverage <10% by file; no API contract tests; large components untestable as written |
| Performance | 6 | Narration worker is well-built; family-merge / GEDCOM are inline and unbounded |
| Scalability | 5 | Single Prisma schema is a tenancy bottleneck; no read replicas or queue layering for non-narration jobs |
| Next.js best practices | 5 | Pages Router used consistently; middleware narrow; client/server boundary mostly respected; data-fetching is `useEffect`-based with no client cache |
| AI / persona safety | 6 | Centralized prompt + sanitization + evidence gating + workspace isolation are real strengths; hallucination detection and prompt versioning are weak |
| Voice cloning readiness | 4 | Consent model is right; enforcement at TTS, watermarking, content filter, and per-profile abuse controls are missing |

---

### Closing notes

What's already good and should not be touched: the `apiHandler` envelope, the auth helpers, `Chat/src/services/chat/PromptBuilder.ts`, `EvidenceGate`, `RetrievalService` workspace scoping, `UI/src/workers/narrationWorker.ts`, `UI/src/lib/security/file-validator.ts`, the field-encryption utility design, and the Prisma schema's overall shape.

What is risky and should be addressed before paying customers exist: TTS consent enforcement (R1), voice synthesis abuse controls (R6), CSRF default-on (R4), `AuditLog` actually being written (R7), `StoryComment` + `Notification` workspace scoping (R8).

What is a quality-of-life issue and can be done in parallel: file decomposition (R3), repository layer (R2), Zod migration (R5), test coverage (R10).

The codebase is closer to a credible v1 than the file sizes suggest. Most of the substance is already written — it just needs to live in the right place.
