# Heard Again Handoff

Last updated: 2026-05-23 11:04:08 CDT

## Current goal

Resolve blockers documented in `docs/qa-blocker-resolution-guide.md` and keep project state preserved for follow-up QA/deploy work.

## Current state

Project root:

`/home/trubuck-design/Projects/Personal/heard-again`

Current branch: `main`

Important pre-existing working tree notes before this QA pass:

- `UI/next-env.d.ts` was already modified.
- `UI/src/services/StoryService.ts` was already modified.
- `.claude/`, `docs/qa-blocker-resolution-guide.md`, and `prisma/migrations/20260523000000_sync_production/` were already untracked.
- This pass did not intentionally edit the pre-existing `StoryService.ts` or `next-env.d.ts` changes.

## Completed in 2026-05-23 QA blocker pass

Implemented fixes for the blockers in `docs/qa-blocker-resolution-guide.md`:

1. People API / family tree node interactivity
   - Verified Person Prisma relations exist in `prisma/schema.prisma`.
   - Added `PersonRepository.findFamilyUnits()`.
   - Updated `PersonService.getPersonDetail()` to use the repository method instead of `(this.repo as any).prisma.familyUnit`.
   - Added service-level error logging and route-level JSON error propagation for `/api/people/[id]`.

2. MUI dialog backdrop blocking toolbar buttons
   - Updated `PersonModal` dialogs with `keepMounted={false}` and backdrop slot props that disable pointer events for invisible backdrops.
   - Delayed clearing `selectedPersonId` in `family-tree.tsx` until after close transition while still closing/refetching immediately.

3. PWA icons / static public assets
   - Generated `UI/public/icon-192.png` and `UI/public/icon-512.png`.
   - Updated existing Next.js 16 proxy file `UI/src/proxy.ts` to whitelist icon/static/legal routes.
   - Note: an attempted `UI/src/middleware.ts` was removed because Next.js 16 rejects simultaneous `proxy.ts` and `middleware.ts`.

4. Reset password without token
   - Updated `reset-password.tsx` to wait for `router.isReady`, normalize array tokens, and show an error when no token is provided instead of spinning forever.
   - Reset submit now sends a string token only.

5. `/terms-legacy`
   - Added `UI/src/pages/terms-legacy.tsx` re-exporting the current terms page so the route renders content.
   - Added `/terms-legacy` to public proxy paths.
   - Updated the reset-password footer “Terms of Legacy” link to `/terms-legacy`.

6. Billing `/api/billing/usage`
   - Confirmed the route is present in the production build route list.
   - Moved `formatBytes` to shared `UI/src/lib/format.ts` and imported it from the billing usage API.
   - Added a focused formatter unit test.

7. Copyright year
   - Replaced remaining `© 2024 Heard Again` footer strings with dynamic `{new Date().getFullYear()}` in public auth/legal pages.

8. Date-field validation regression coverage
   - Added `UI/src/__tests__/schemas/person.test.ts` to document that cleared optional date fields must be `null`, while empty strings remain rejected by schema validation.

## Files changed by this pass

- `UI/public/icon-192.png`
- `UI/public/icon-512.png`
- `UI/src/__tests__/format.test.ts`
- `UI/src/__tests__/schemas/person.test.ts`
- `UI/src/components/modals/PersonModal.tsx`
- `UI/src/components/pages/CreateAccountPage.tsx`
- `UI/src/components/pages/LoginPage.tsx`
- `UI/src/lib/format.ts`
- `UI/src/pages/api/billing/usage.ts`
- `UI/src/pages/api/people/[id].ts`
- `UI/src/pages/family-tree.tsx`
- `UI/src/pages/forgot-password.tsx`
- `UI/src/pages/reset-password.tsx`
- `UI/src/pages/terms.tsx`
- `UI/src/pages/terms-legacy.tsx`
- `UI/src/proxy.ts`
- `UI/src/server/repositories/PersonRepository.ts`
- `UI/src/services/PersonService.ts`
- `docs/memory-bank/HANDOFF.md`
- `docs/memory-bank/TASK_LOG.md`

## Validation run

- `npx jest src/__tests__/format.test.ts src/__tests__/schemas/person.test.ts --runInBand`
  - Passed: 2 suites, 4 tests.
  - Warning observed: Jest haste-map naming collision with `.next/standalone/UI/package.json`; tests still passed.
- `npm --workspace UI run typecheck`
  - Passed.
- `npm --workspace UI run build`
  - Initially failed because a new `middleware.ts` conflicted with existing Next.js 16 `proxy.ts`.
  - Fixed by deleting `middleware.ts` and updating `proxy.ts`.
- `npm --workspace UI run typecheck && npm --workspace UI run build`
  - Passed.
  - Build warning remains: Turbopack NFT trace warning from `UI/next.config.js` via `UI/src/pages/api/assets/[id]/download.ts`.
  - Build route list includes `/api/billing/usage` and `/terms-legacy`.

## Known issues / follow-up

- Browser/manual QA against an authenticated local or production session was not run in this pass.
- Existing handoff items from `qa_validation_report.md` are still separate from this guide:
  - Sign out redirect to 404.
  - Relative/person delete confirmation in profile-preview flow.
  - Media/document/audio flows need follow-up validation.
- Pre-existing local working tree changes in `UI/next-env.d.ts` and `UI/src/services/StoryService.ts` remain and should be reviewed before commit.
- Jest warning about `.next/standalone` package naming collision can be cleaned by removing stale build output or adjusting Jest ignore config.

## Recommended next action

Run browser QA with an authenticated session for:

1. Family tree node buttons: STORY, EDIT, FOCUS, KIN, ADD.
2. Open/close person modal, then click toolbar export/import buttons.
3. `/icon-192.png`, `/icon-512.png`, `/manifest.json`, `/terms-legacy`, and `/reset-password` without token.
4. Dashboard/subscription page usage cards backed by `/api/billing/usage`.

Then review/commit the intended QA blocker diff separately from pre-existing unrelated modifications.

## Notes for future agents

- UI uses Next.js Pages Router with Next.js 16 `proxy.ts`; do not add `middleware.ts` unless `proxy.ts` is removed/renamed.
- Prisma schema changes require `npm run db:generate`; no Prisma schema changes were made in this pass.
- Do not print secrets from `.env`, Vercel, Trigger.dev, RunPod, or R2.
- Avoid broad rewrites. Prefer small focused diffs and targeted validation.
