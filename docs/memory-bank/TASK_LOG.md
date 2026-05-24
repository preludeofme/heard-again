# Heard Again Task Log

Last updated: 2026-05-23 11:04:08 CDT

This is an append-oriented log for project work. Keep entries concise and factual.

## 2026-05-24 — Server-side family member search overhaul

### Completed

Reworked the family-member search flow so large familyspaces are searched by the server instead of by a capped client-side list:

- Added shared person-search helper `UI/src/lib/person-search.ts` for tokenization and name-field Prisma where clauses.
- Updated `PersonService.listPeople()`, global people search, search suggestions, and `/api/search/people` to reuse the shared name-field helper and avoid duplicated field lists.
- Added `middleName` and `maidenName` to the `PersonListItem` DTO and mapper.
- Updated `MemberSwitcherFlyout` to:
  - load only a small default browse page (`limit=50`) when opened;
  - perform debounced remote `/api/people?search=...&limit=50` searches for typed queries;
  - abort stale fetches and merge selected search results into the local cache for recent-member scoping.
- Removed the stale `family-tree.tsx` `/api/people?limit=500` searchable-people load and unused `FamilyTreeSearchOverlay.tsx` component.
- Removed unused `searchablePeople` / initial search props from `FamilyTreePage`.
- Made global `/search` people result cards navigate to `/profile/[id]` when clicked.

### Commands/checks run

- `npm --workspace UI test -- --runInBand src/__tests__/services/PersonService.search.test.ts src/__tests__/lib/person-search.test.ts`
  - Passed: 2 suites, 4 tests.
- `npm --workspace UI run typecheck`
  - Passed.
- `npm --workspace UI run build`
  - Passed.
  - Existing warning remains: Turbopack NFT trace warning from `UI/next.config.js` via `UI/src/pages/api/assets/[id]/download.ts`.

### Working tree notes

- `UI/next-env.d.ts` was already modified before this search pass and was not intentionally changed here.
- `.claude/` remains untracked from prior local agent state.

## 2026-05-23 — QA blocker resolution guide implementation

### Completed

Worked through `docs/qa-blocker-resolution-guide.md` and implemented the documented blocker fixes:
- People API / family tree node interactivity:
  - Verified the required Person relations exist in `prisma/schema.prisma`.
  - Added `PersonRepository.findFamilyUnits()`.
  - Updated `PersonService.getPersonDetail()` to use the repository method instead of `(this.repo as any).prisma.familyUnit`.
  - Added service-level error logging and route-level JSON error propagation for `/api/people/[id]`.
- MUI dialog backdrop:
  - Added `keepMounted={false}` and invisible-backdrop pointer-event protection to `PersonModal` dialogs.
  - Delayed clearing selected person state in `family-tree.tsx` until after close transition.
- PWA/static public assets:
  - Generated `UI/public/icon-192.png` and `UI/public/icon-512.png`.
  - Updated existing Next.js 16 `UI/src/proxy.ts` public routes for icons/static/legal assets.
  - Removed attempted `UI/src/middleware.ts` after build showed Next.js 16 requires `proxy.ts` only when both exist.
- Reset password without token:
  - Updated `reset-password.tsx` to wait for `router.isReady`, normalize token arrays, and show an error for missing tokens instead of an infinite spinner.
- `/terms-legacy`:
  - Added `UI/src/pages/terms-legacy.tsx` and allowed it through proxy public routes.
  - Updated reset-password footer Terms of Legacy link to `/terms-legacy`.
- Billing usage:
  - Moved `formatBytes` to `UI/src/lib/format.ts` and imported it from `/api/billing/usage`.
  - Confirmed `/api/billing/usage` appears in the Next build route list.
- Copyright year:
  - Replaced hardcoded `© 2024 Heard Again` strings with dynamic `{new Date().getFullYear()}` in public auth/legal pages.
- Added focused regression tests for formatter behavior and person date schema normalization expectations.

### Commands/checks run

- `npx jest src/__tests__/format.test.ts src/__tests__/schemas/person.test.ts --runInBand`
  - Passed: 2 suites, 4 tests.
  - Warning: Jest haste-map naming collision with `.next/standalone/UI/package.json`; tests still passed.
- `npm --workspace UI run typecheck`
  - Passed.
- `npm --workspace UI run build`
  - Initially failed due to simultaneous `middleware.ts` and `proxy.ts`.
- `npm --workspace UI run typecheck && npm --workspace UI run build`
  - Passed after moving the static-route whitelist into `proxy.ts`.
  - Build warning remains: Turbopack NFT trace warning from `UI/next.config.js` via `UI/src/pages/api/assets/[id]/download.ts`.

### Working tree notes

Pre-existing before this pass:

- `UI/next-env.d.ts` modified.
- `UI/src/services/StoryService.ts` modified.
- `.claude/`, `docs/qa-blocker-resolution-guide.md`, and `prisma/migrations/20260523000000_sync_production/` untracked.

This pass intentionally changed/added the QA blocker files listed in `docs/memory-bank/HANDOFF.md`.

### Recommended next task

Run authenticated browser QA for the fixed flows, especially family tree node actions and post-modal toolbar clicks, then review/commit the QA blocker diff separately from the pre-existing unrelated modifications.

## 2026-05-20 — Project rediscovery and memory docs

### Infrastructure tasks completed
- Successfully updated production Google OAuth credentials.
- Configured Vercel `TTS_PROVIDER=runpod_serverless` and `RUNPOD_TTS_ENDPOINT_ID`.
- Fixed `CHAT_SYSTEM_URL` to the bare chat-service base URL.
- Configured Cloudflare R2 CORS for direct browser PUT uploads.

### Commands run

- `pwd`
- `date '+%Y-%m-%d %H:%M:%S %Z'`
- `git status --short --branch`
- `git log --oneline -5`
- File searches and reads through Hermes file tools.

### Findings

- Working branch at discovery was `main`.
- Recent HEAD at discovery was `35a6074 fix: cleaned up docs`.
- Working tree had untracked `.claude/` before project memory docs were written.
- Trigger.dev root config points tasks to `UI/src/trigger`.
- Missing RunPod worker remains documented as outstanding.
- QA report contains critical user-facing blockers around sign out, profile edit date fields, and delete confirmation.

### Recommended next task

Fix profile edit 400 errors caused by empty date fields being submitted as empty strings.

### Validation status

No product code changes were made in this pass. Validation for this pass is limited to verifying that the project memory docs exist and contain the intended handoff context.

## 2026-05-20 — Infrastructure tasks marked complete

### Completed

- Marked manual infrastructure/deployment tasks complete based on Ryan's update:
  - Production Google OAuth credentials updated.
  - Vercel `TTS_PROVIDER=runpod_serverless` and `RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3` set.
  - Vercel `CHAT_SYSTEM_URL` fixed to the bare chat-service base URL.
  - Cloudflare R2 CORS configured for direct browser PUT uploads.

### Notes

- No secret values were recorded.
- Remaining RunPod worker item should be reassessed separately as a code-side architecture/deployment task.

## 2026-05-20 — Fixed duplicate React invalid-hook-call blocker

### Completed

- Reproduced `/login` runtime failure: `Cannot read properties of null (reading 'useState')` with Next.js invalid hook call warning.
- Confirmed root cause was duplicate React installs:
  - root `node_modules/react` / `react-dom` at `19.2.6`
  - stale nested `UI/node_modules/react` / `react-dom` at `19.2.4`
- Updated `UI/package.json` to pin `react` and `react-dom` to `19.2.6`.
- Removed stale nested React package-lock entries and ran `npm install --workspaces`, leaving React resolved only from root `node_modules`.
- Updated `UI/next.config.js` webpack aliases for `react`, `react-dom`, `react/jsx-runtime`, and `react/jsx-dev-runtime` to the workspace root React packages.

### Validation

- Verified no nested UI React packages remain physically installed.
- Verified `/login` renders successfully via browser automation against `https://localhost:4777/login`.
- Verified rendered page text includes the login UI and no `useState` / invalid hook call errors were reported in the browser run.
- Screenshot captured at `/tmp/heard-again-login-react-fixed.png`.

### Follow-up notes

- Full `npm run dev` still reports separate non-blocking service issues:
  - Trigger.dev CLI profile/project mismatch for `proj_pcwbloaahiyfikeyicmv`.
  - TTS model startup import error: `cannot import name 'auto_docstring' from 'transformers.utils'`.
- These did not block the main login UI render test.

## 2026-05-20 — Usability and Wayfinding Audit

### Completed

- Conducted Desktop and Mobile Usability and Wayfinding Audit on public-facing pages.
- Identified multiple Navigation Friction points, Mobile UX breaks, and Critical Blockers.
- Generated `usability_audit_report.md` artifact with full findings.

### Recommended next tasks (from Audit)

- **Auth Blocker**: Fix CSRF / 403 Forbidden blocker on the Sign In and Sign Up routes.
- **Routing**: Fix `/pricing` route forcefully redirecting to `/login` for unauthenticated users.
- **Accessibility**: Add `aria-label`s to the unlabeled circular buttons in the footer.
- **Wayfinding**: Standardize header navigation links across all public routes (Landing, Privacy, Terms, Login, Signup) to prevent dead ends.
- **Mobile UX**: Implement responsive hamburger menu or proper layout collapsing for horizontal nav on mobile viewports.
- **Mobile UX**: Stack registration form inputs vertically on mobile viewports.
- **Taxonomy**: Standardize action terminology (e.g. replace "Start Your Story" / "Start Story" / "Start My Living Story" with "Get Started" and "Create Account").
