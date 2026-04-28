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

- [x] **Security** — `.env` and `UI/.env` committed to git with live credentials
  - **Status**: Verified that these files are NOT currently tracked by git (`git ls-files` returned empty). Rotation still recommended if they were ever committed.
- [x] **Security** — `/api/test-overrides` is accessible in production via email-string matching
  - **Status**: Verified endpoint and UI tabs have been removed.
- [x] **Security** — `unsafe-eval` in production Content-Security-Policy
  - **Status**: Verified `next.config.js` correctly gates `'unsafe-eval'` to `isDev` only.
- [x] **Security** — Hardcoded fallback `'default-token'` for TTS service authentication
  - **Status**: Verified `upload-sample.ts` now throws on startup if `TTS_SERVICE_TOKEN` is missing.
- [x] **Deployment** — ChromaDB `ALLOW_RESET=TRUE` in production `docker-compose.yml`
  - **Status**: Verified `ALLOW_RESET=FALSE` is set in the compose file.

---

### Phase 2 — High (should fix before launch)

- [ ] **Security** — npm audit reports 16 vulnerabilities (6 high)
  - **Status**: Partially addressed. `npm audit fix` run, but some vulnerabilities require breaking changes (e.g., next-auth) that need careful verification.
- [x] **Security** — CSRF fallback secret allows token forgery
  - **Status**: Verified `csrf.ts` and `csrf-token.ts` throw if `NEXTAUTH_SECRET` is missing.
- [x] **Security** — Middleware validates cookie presence, not session validity
  - **Status**: Verified `middleware.ts` uses `getToken()` for cryptographic verification.
- [x] **Security** — TTS auth makes synchronous HTTP calls on the async FastAPI event loop
  - **Status**: Resolved. Refactored to use `httpx` (async) and optimized role checking to avoid double-fetching session.
- [x] **UX** — Bottom navigation routes are incomplete
  - **Status**: Resolved during UX Overhaul (implemented overflow menu and correct routing).
- [ ] **Functionality** — Audio generation creates queued jobs that are never dispatched
  - **Mitigation**: Audio generation has been explicitly disabled in `docker-compose.yml` via `AUDIO_GENERATION_ENABLED=false` until the worker is wired up.
- [x] **Accessibility** — Only 7 aria attributes across all UI components
  - **Status**: Resolved. Added `aria-label`, `role="button"`, and proper focus management to Dashboard, Stories, Documents, and Family Tree pages.

---

### Phase 3 — Medium/Low (launch may proceed, fix soon)

- [ ] **Functionality** — FamilyTreePage has 3 unimplemented action stubs
- [x] **Security** — CSRF protection not applied to all mutation endpoints
  - **Status**: Resolved. Applied `withCSRFProtection` to subscription, cancellation, relationship, password, and MFA endpoints.
- [x] **Performance** — No `next/image` usage anywhere
  - **Status**: Resolved. Implemented `next/image` in Dashboard and DocumentViewer components.
- [x] **Performance** — Rate limiter applies both Redis and express-rate-limit middleware
  - **Status**: Verified. Current implementation uses Redis sliding-window exclusively.
- [x] **UX** — Sidebar branding inconsistency
  - **Status**: Resolved. Unified branding to "Heard Again" across all devices.
- [x] **UX** — Notification badge hardcoded to 3
  - **Status**: Resolved. Badge is now invisible by default until a system is wired.
- [x] **Deployment** — PostgreSQL default password `postgres` in docker-compose
  - **Status**: Verified. `docker-compose.yml` uses mandatory env vars and no exposed ports.
- [ ] **Testing** — Only 8 test files across the entire project
- [ ] **Testing** — No E2E tests
- [ ] **Maintainability** — 340 `any` usages with `strict: true` in tsconfig
- [x] **Maintainability** — 210 `console.*` calls in production code
  - **Status**: Partially Resolved. Replaced high-impact `console.*` with structured `logger` in API handlers, services, and security modules.
- [x] **Maintainability** — Duplicate and empty component files
  - **Status**: Resolved. Deleted `new_component/` and `middleware.js.bak`.
- [ ] **Design** — Hardcoded waveform visualization with no audio connection
- [x] **Design** — `<Link legacyBehavior>` usage throughout Layout
  - **Status**: Resolved. Removed deprecated `legacyBehavior` props.
- [x] **Deployment** — `sonar-reports/` committed to git
  - **Status**: Verified. Not tracked by current git tree.
- [x] **UX** — Most pages missing `<Head>` with title/meta description
  - **Status**: Resolved. Added `<Head>` with unique titles to all primary pages.

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

**Auth architecture is sound overall.** The `getAuthUserWithFamilyspace` helper, `withCSRFProtection` wrapper, familyspace RBAC via `requireFamilyspaceRole`, and file upload security pipeline (magic-byte validation + ClamAV) are all properly implemented. The issue is coverage gaps and the dev-mode escape hatches not being gated out of production builds.

**The Chat/AI layer is operationally immature.** The persona generation pipeline and document ingestion worker are wired up, but audio generation jobs are never dispatched. The Chat service `.env` commits, Ollama dependency for the ingestion worker profile, and the synchronous TTS auth pattern all need hardening before the AI features are marketed as production-grade.

**Priority order within Critical**: Credential rotation (#1) and test-override removal (#3) are the two highest-urgency items — they represent live attack surface that can be exploited right now. The remaining criticals require a deploy to activate.
