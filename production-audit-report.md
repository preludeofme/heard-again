# Production Audit Report

**Date**: 2026-04-14
**Application**: Heard Again — Family Story Preservation Platform
**Branch**: feat/mvp-release
**Auditor**: Claude Code

---

## Verdict: ❌ NOT READY

The application has multiple critical security vulnerabilities — including real credentials committed to git history, a test-bypass endpoint accessible in production, and high-severity package vulnerabilities — that must be resolved before any public deployment.

---

## Summary

Heard Again is a Next.js 14 + MUI application with a Python TTS service, Node.js Chat service, PostgreSQL, Redis, ChromaDB, and ClamAV. The architecture is well-structured, auth middleware is in place, CSRF protection exists on most mutation endpoints, and the file upload pipeline includes magic-byte validation and ClamAV scanning. However, actual credentials are committed to git (Google OAuth, Cloudflare tokens, NextAuth secret), a developer test-override endpoint is reachable in production via email-string matching, and the Next.js CSP includes `unsafe-eval`. Feature completeness gaps also exist: audio generation is not wired to the TTS queue, interactive elements in the family tree have TODO stubs, and the notification badge is hardcoded.

---

## Category Results

| Category             | Status | Critical | High | Medium | Low |
| -------------------- | ------ | -------- | ---- | ------ | --- |
| Design & Aesthetics  | ⚠️     | 0        | 1    | 1      | 3   |
| UX & Navigation      | ⚠️     | 0        | 2    | 2      | 2   |
| Functionality        | ⚠️     | 0        | 1    | 3      | 1   |
| Accessibility        | ❌     | 0        | 1    | 1      | 1   |
| Performance          | ⚠️     | 0        | 0    | 2      | 1   |
| Security             | ❌     | 6        | 5    | 2      | 1   |
| Testing              | ❌     | 0        | 2    | 1      | 0   |
| Deployment Readiness | ❌     | 2        | 2    | 1      | 1   |
| Maintainability      | ⚠️     | 0        | 0    | 3      | 2   |

---

## Findings

---

### Phase 1 — Critical (must fix before production)

- [ ] **Security** — `.env` and `UI/.env` committed to git with live credentials
  - **Files**: `.env:1-45`, `UI/.env:1-46` (confirmed via `git ls-files`)
  - **Issue**: Both files are tracked in git and contain: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (live OAuth app), `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`. Anyone with read access to the repo can authenticate as the application to Google, access Cloudflare, and forge session tokens.
  - **Fix**: Rotate all listed credentials immediately. Remove files from git history (`git filter-repo --path .env --invert-paths`). Add `.env` and `UI/.env` to `.gitignore` (already present for root `.env` but `UI/.env` is tracked). Move secrets to a secrets manager or host environment variables.

- [ ] **Security** — `Chat/.env` committed to git with dev placeholder secrets
  - **Files**: `Chat/.env:20-21`
  - **Issue**: `JWT_SECRET="dev-jwt-secret-change-in-production"` and `SESSION_SECRET="dev-session-secret-change-in-production"` are committed. The comment is a warning that was never acted on. `CHROMA_CREDENTIALS="admin:admin123"` is also present.
  - **Fix**: Same as above — remove from git history, rotate, inject via environment.

- [ ] **Security** — `/api/test-overrides` is accessible in production via email-string matching
  - **Files**: `UI/src/pages/api/test-overrides.ts:33-37`
  - **Issue**: The production guard is: `const isTestUser = email.includes('test') || email.includes('dev') || email.includes('local')`. Any user whose email contains these substrings (e.g. `johndeveloper@company.com`, `localfarms@mail.com`) gains full access to bypass permission checks, mock a paid plan, and enable unlimited usage. The endpoint is also exposed in the account page UI to all authenticated users without an environment check.
  - **Fix**: Delete `/api/test-overrides.ts` entirely and remove the "Test Overrides" tab from `account.tsx`. This endpoint has no place in a production build.

- [ ] **Security** — `unsafe-eval` in production Content-Security-Policy
  - **Files**: `UI/next.config.js:42`
  - **Issue**: The global CSP applied to all routes includes `'unsafe-eval'` in `script-src`. This nullifies XSS protection by allowing `eval()`, `new Function()`, and similar constructs. This is the CSP that ships to production via `next.config.js` headers.
  - **Fix**: Remove `'unsafe-eval'` from the CSP. If Next.js dev mode requires it, conditionally set it only when `process.env.NODE_ENV !== 'production'` in `next.config.js`.

- [ ] **Security** — Hardcoded fallback `'default-token'` for TTS service authentication
  - **Files**: `UI/src/pages/api/voice/upload-sample.ts:86`
  - **Issue**: `'Authorization': \`Bearer ${process.env.TTS_SERVICE_TOKEN || 'default-token'}\`` — if `TTS_SERVICE_TOKEN` is unset, all upload requests reach the TTS service with a predictable token value. Any user on the same network can directly call the TTS service with `Bearer default-token`.
  - **Fix**: Remove the fallback. Throw at startup if `TTS_SERVICE_TOKEN` is not set. Add `TTS_SERVICE_TOKEN` to the docker-compose environment and `.env.example`.

- [ ] **Deployment** — ChromaDB `ALLOW_RESET=TRUE` in production `docker-compose.yml`
  - **Files**: `docker-compose.yml:212`
  - **Issue**: `ALLOW_RESET=TRUE` enables the ChromaDB HTTP `/api/v1/reset` endpoint, which destroys all collections and embeddings. Since ChromaDB is on the internal network, any compromised internal service can wipe the entire AI knowledge base.
  - **Fix**: Remove `ALLOW_RESET=TRUE` or set `ALLOW_RESET=FALSE`. This flag is a dev/test convenience only.

---

### Phase 2 — High (should fix before launch)

- [ ] **Security** — npm audit reports 16 vulnerabilities (6 high)
  - **Files**: `UI/package.json` (dependency tree)
  - **Issue**: `npm audit` identifies 6 high-severity issues including: a Next.js DoS via Server Components (GHSA-q4gf-8mx6-v5v3), `defu` prototype pollution (GHSA-737v-mqg7-c878), `cookie` out-of-bounds acceptance in `next-auth`, and `@tootallnate/once` control flow issue. The `next` package itself is flagged (versions 16.0.0-beta.0 – 16.2.2).
  - **Fix**: Run `npm audit fix` for non-breaking updates. Review `npm audit fix --force` output before applying breaking changes. Update `next-auth` to ≥4.24.7 for the cookie fix.

- [ ] **Security** — CSRF fallback secret allows token forgery
  - **Files**: `UI/src/lib/security/csrf.ts:6`, `UI/src/pages/api/csrf-token.ts:6`
  - **Issue**: `const CSRF_SECRET = process.env.NEXTAUTH_SECRET || 'csrf-fallback-secret'`. If `NEXTAUTH_SECRET` is ever unset, CSRF tokens are derived with the publicly known string `'csrf-fallback-secret'`. An attacker can precompute valid CSRF tokens for any session.
  - **Fix**: Remove the fallback. Throw at server startup if `NEXTAUTH_SECRET` is missing.

- [ ] **Security** — Middleware validates cookie presence, not session validity
  - **Files**: `UI/src/middleware.ts:27-30`
  - **Issue**: The middleware checks `request.cookies.get('next-auth.session-token')?.value` and redirects only if the cookie is absent. It does not verify the token's integrity or expiration. A request with any value in that cookie bypasses the redirect guard.
  - **Fix**: Use `getToken()` from `next-auth/jwt` in middleware to cryptographically verify the token before allowing access. This is the standard NextAuth middleware pattern.

- [ ] **Security** — TTS auth makes synchronous HTTP calls on the async FastAPI event loop
  - **Files**: `TTS/app/auth.py:45`, `TTS/app/auth.py:120`
  - **Issue**: `requests.get(...)` (synchronous) is called inside `async def validate_token` and `async def require_workspace_role`. This blocks the uvicorn event loop for every authenticated request, degrading throughput to single-threaded under load.
  - **Fix**: Replace `requests` with `httpx` (async). Use `async with httpx.AsyncClient() as client: await client.get(...)`.

- [ ] **Security** — TTS role check calls NextAuth session endpoint twice per request
  - **Files**: `TTS/app/auth.py:45`, `TTS/app/auth.py:120`
  - **Issue**: `validate_token` fetches the session, then `require_workspace_role` fetches it again. Every protected TTS route makes 2 synchronous HTTP calls to the Next.js auth endpoint, doubling latency and load on the auth service.
  - **Fix**: Pass the session data from `validate_token` through to `require_workspace_role` via dependency injection rather than re-fetching.

- [ ] **UX** — Bottom navigation routes are incomplete
  - **Files**: `UI/src/components/layout/Layout.tsx:217-239`
  - **Issue**: The mobile `BottomNavigation` defines 5 actions but the `onChange` handler only maps 3 routes: `['/profile', '/voice-lab', '/stories']`. Tapping "Add" (index 2) navigates to `/stories`. Tapping "Profile" (index 4) calls `router.push(undefined)`, causing a navigation error.
  - **Fix**: Map all 5 bottom nav items to valid routes, or remove the unmapped ones. The `getMobileNavValue()` function also falls through to `default: return 0` for all unmatched paths.

- [ ] **Functionality** — Audio generation creates queued jobs that are never dispatched
  - **Files**: `UI/src/pages/api/stories/[id]/generate-audio.ts:49-52`
  - **Issue**: The generate-audio endpoint creates a `VoiceGenerationJob` with status `'QUEUED'` and returns, explicitly noting in a TODO that it does not dispatch to a queue. Users can click "Generate Audio" and receive a job ID that will remain in `QUEUED` state forever.
  - **Fix**: Wire the job to the ingestion worker queue (BullMQ) before launch, or disable the Generate Audio button in the UI with a "Coming Soon" state until the worker integration is complete.

- [ ] **Accessibility** — Only 7 aria attributes across all UI components
  - **Files**: All files under `UI/src/components/`
  - **Issue**: The family tree interactive canvas, audio player buttons, modal dialogs, and navigation items lack `aria-label`, `aria-describedby`, and proper `role` attributes. Keyboard-only users and screen reader users cannot navigate the application. MUI components provide accessibility when used correctly but many interactive `<Box>` components here lack it.
  - **Fix**: Add `aria-label` to all icon-only buttons (`IconButton`), `role="dialog"` and `aria-labelledby` to modals, and ensure the family tree SVG canvas has keyboard event handlers and focus management.

---

### Phase 3 — Medium/Low (launch may proceed, fix soon)

- [ ] **Functionality** — FamilyTreePage has 3 unimplemented action stubs
  - **Files**: `UI/src/components/pages/FamilyTreePage.tsx:460`, `:465`, `:505`
  - **Issue**: `// TODO: Navigate to story creation with person pre-selected`, `// TODO: Open voice training modal with person pre-selected`, `// TODO: Navigate to story detail page` — buttons exist and are clickable but do nothing.
  - **Fix**: Implement the navigation/modal logic or hide the buttons until implemented.

- [ ] **Security** — CSRF protection not applied to all mutation endpoints
  - **Files**: `UI/src/pages/api/voice/synthesize.ts`, `UI/src/pages/api/stories/[id]/generate-audio.ts`, multiple others
  - **Issue**: `withCSRFProtection` is applied inconsistently. `POST /api/people` and `POST /api/stories` are protected; `POST /api/voice/synthesize` and `POST /api/stories/[id]/generate-audio` are not. CSRF is only half-deployed.
  - **Fix**: Apply `withCSRFProtection` to all state-mutating endpoints or adopt a consistent pattern via the `apiHandler` wrapper.

- [ ] **Performance** — No `next/image` usage anywhere
  - **Files**: All component files (0 imports of `next/image`)
  - **Issue**: All images use `<Avatar src=...>`, CSS `background-image`, or `<img>` tags. Next.js's `Image` component provides automatic WebP conversion, lazy loading, and blur placeholders — none of which are active.
  - **Fix**: Replace high-value image usages (hero images, avatars with known dimensions, document thumbnails) with `next/image`.

- [ ] **Performance** — Rate limiter applies both Redis and express-rate-limit middleware
  - **Files**: `UI/src/lib/security/rate-limiter.ts:65-143`
  - **Issue**: `withRateLimit` checks Redis first, then also runs `express-rate-limit` middleware via a mocked Express adapter. This is double-limiting. The `express-rate-limit` instance uses in-memory storage which doesn't work across multiple Node.js processes.
  - **Fix**: Remove the `express-rate-limit` import and the mock adapter block. The Redis sliding window implementation (`rateLimitCheck`) is correct and sufficient.

- [ ] **UX** — Sidebar branding inconsistency
  - **Files**: `UI/src/components/layout/Layout.tsx:176`, `:261`
  - **Issue**: Mobile header shows "Heard Again"; desktop sidebar shows "The Living Archive". These are different names for the same product.
  - **Fix**: Align to one brand name consistently.

- [ ] **UX** — Notification badge hardcoded to 3
  - **Files**: `UI/src/components/layout/Layout.tsx:200`
  - **Issue**: `<Badge badgeContent={3} color="primary">` — always shows 3 notifications regardless of actual state. No notification system is wired up.
  - **Fix**: Either hide the badge until a notification system is implemented or wire it to real data.

- [ ] **Deployment** — PostgreSQL default password `postgres` in docker-compose
  - **Files**: `docker-compose.yml:118-119`
  - **Issue**: `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}` defaults to `postgres`. Port `5433` is also exposed to the host. An external process that reaches port 5433 can authenticate with the well-known default.
  - **Fix**: Remove `ports: - "5433:5432"` from the `db` service (expose only via internal network). Require `POSTGRES_PASSWORD` as a mandatory env var.

- [ ] **Testing** — Only 8 test files across the entire project
  - **Files**: `UI/src/__tests__/` (3 files), `Chat/src/__tests__/` (5 files)
  - **Issue**: The UI has 3 test files covering: CSRF logic, chat conversation URL shapes, and session delete behavior. There are zero tests for: API route auth/authorization, Prisma service layer, file upload pipeline, voice training flow, workspace RBAC. The Chat service has 5 service unit tests but no API/integration coverage.
  - **Fix**: Before launch, add integration tests for at minimum: auth guard (confirm unauthenticated requests are rejected), workspace isolation (user A cannot read user B's data), and file upload (validation rejects invalid files).

- [ ] **Testing** — No E2E tests
  - **Files**: Project root
  - **Issue**: No Playwright or Cypress test suite exists. Critical user flows (signup → onboarding → create person → upload document → chat with persona) are untested end-to-end.
  - **Fix**: Add a minimal Playwright suite covering the critical happy path before launch.

- [ ] **Maintainability** — 340 `any` usages with `strict: true` in tsconfig
  - **Files**: Throughout `UI/src/` (340 occurrences)
  - **Issue**: `strict: true` is configured but 340 `any` usages exist. Key examples: `VoiceLabPage` controller typed as `{ trainingJob: any }`, `sanitizeAssetResponse(asset: any)`, `DocumentsPage` handler parameters typed as `any`. Type coverage is illusory.
  - **Fix**: Progressively type the highest-risk surfaces: API response types, service return types, and component props.

- [ ] **Maintainability** — 210 `console.*` calls in production code
  - **Files**: Throughout `UI/src/` (210 occurrences outside tests)
  - **Issue**: The project has a structured `logger` (`pino`-based), but most files use raw `console.log/error/warn`. Console output is unstructured and will not integrate with log aggregation.
  - **Fix**: Replace `console.*` calls with `logger.*` calls using the existing `UI/src/lib/logger.ts`.

- [ ] **Maintainability** — Duplicate and empty component files
  - **Files**: `UI/src/components/layout/new_component/ActiveMemberHeader.tsx` (1 line, empty), `UI/src/components/layout/ActiveMemberHeader.tsx` (real implementation), `UI/src/middleware.js.bak`
  - **Issue**: `new_component/` directory contains an empty file. Two `ActiveMemberHeader.tsx` files exist at different paths. `middleware.js.bak` is committed.
  - **Fix**: Delete `new_component/` directory and `middleware.js.bak`.

- [ ] **Design** — Hardcoded waveform visualization with no audio connection
  - **Files**: `UI/src/components/pages/Dashboard.tsx:118-141`
  - **Issue**: 22 `<Box>` elements hardcoded as a static decorative waveform. The play/pause button toggles `isPlaying` state but plays nothing. The "Listen to Legacy" card plays no audio.
  - **Fix**: Connect to a real audio source or make the waveform clearly decorative with a "No audio recorded yet" empty state.

- [ ] **Design** — `<Link legacyBehavior>` usage throughout Layout
  - **Files**: `UI/src/components/layout/Layout.tsx:278`, `:313`
  - **Issue**: `legacyBehavior` is deprecated in Next.js 13+. It wraps an `<a>` tag that produces nested anchor elements when MUI components are involved.
  - **Fix**: Remove `legacyBehavior` and `passHref`. Use `<Link href={item.href}>` directly and let MUI's `component={Link}` prop handle it.

- [ ] **Deployment** — `sonar-reports/` committed to git
  - **Files**: `sonar-reports/*.json`
  - **Issue**: Internal SonarQube scan results (including bugs, vulnerabilities, code smell lists with file paths and line numbers) are committed. This exposes the internal code quality map to anyone with repo access.
  - **Fix**: Add `sonar-reports/` to `.gitignore` and remove from git history.

- [ ] **UX** — Most pages missing `<Head>` with title/meta description
  - **Files**: `UI/src/pages/stories.tsx`, `family-tree.tsx`, `voice-lab.tsx`, `documents.tsx`, `timeline.tsx`, and most others
  - **Issue**: Only `index.tsx` has a `<Head>` with page title and description. All other pages inherit Next.js defaults (`Heard Again`). Poor SEO and browser tab labeling.
  - **Fix**: Add meaningful `<title>` tags to each page.

---

## Launch Checklist

- [ ] All Critical findings resolved
- [ ] All High findings resolved or accepted with justification
- [ ] Credentials rotated and removed from git history
- [ ] `npm audit fix` applied, 0 high-severity vulnerabilities remaining
- [ ] Build passes cleanly (`tsc --noEmit`, no lint errors)
- [ ] Test suite passes
- [ ] ChromaDB `ALLOW_RESET` disabled in production compose
- [ ] PostgreSQL port not exposed to host; strong password required
- [ ] `TTS_SERVICE_TOKEN` set as mandatory environment variable
- [ ] CSRF fallback secret removed; startup fails if `NEXTAUTH_SECRET` unset
- [ ] `unsafe-eval` removed from production CSP
- [ ] Test override API deleted from codebase
- [ ] Deployment pipeline (CI/CD) tested end-to-end
- [ ] Environment variables confirmed set in deployment target

---

## Notes

**Auth architecture is sound overall.** The `getAuthUserWithWorkspace` helper, `withCSRFProtection` wrapper, workspace RBAC via `requireWorkspaceRole`, and file upload security pipeline (magic-byte validation + ClamAV) are all properly implemented. The issue is coverage gaps and the dev-mode escape hatches not being gated out of production builds.

**The Chat/AI layer is operationally immature.** The persona generation pipeline and document ingestion worker are wired up, but audio generation jobs are never dispatched. The Chat service `.env` commits, Ollama dependency for the ingestion worker profile, and the synchronous TTS auth pattern all need hardening before the AI features are marketed as production-grade.

**Priority order within Critical**: Credential rotation (#1) and test-override removal (#3) are the two highest-urgency items — they represent live attack surface that can be exploited right now. The remaining criticals require a deploy to activate.
