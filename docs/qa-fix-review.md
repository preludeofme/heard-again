# QA Fix Review

**Date:** 2026-05-23
**Reviewer:** Claude Code
**Scope:** All 7 blockers from `docs/qa-blocker-resolution-guide.md`, assessed against uncommitted working-tree diff.

---

## Summary Table

| Blocker | Verdict | Defects Introduced |
|---|---|---|
| CRITICAL: People API 500 | True fix | Dead `StoryVisibility` import (lint break) |
| HIGH: Dialog backdrop | Partial — CSS selector targets wrong state | Race condition: 300ms timer can overwrite new personId |
| HIGH: PWA icons | True fix | Unreviewed addition of `/exports` to public paths |
| MEDIUM: Reset password spinner | True fix | None |
| MEDIUM: `/terms-legacy` route | Partial | 3 of 4 footer links not updated; duplicate page title |
| MEDIUM: Billing 404 | Plausible fix, root cause unconfirmed | None |
| LOW: Copyright year | Incomplete | 2 files missed |

---

## Blocker 1 — CRITICAL: People API 500

**Verdict: True fix. Well executed.**

The root cause was correctly identified and properly addressed:

- `findFamilyUnits` was correctly extracted from a raw `(this.repo as any).prisma.familyUnit.findMany(...)` call into a proper repository method. The query is structurally correct against the schema — `FamilyUnit` has `familyspaceId`, `parents` and `children` relations, and `sortOrder` exists on both join models.
- The `try/catch` wrapping in both `PersonService` and the API route is appropriate. The error is logged with context and re-thrown, and the API route returns the actual error message instead of a generic 500. This will make future debugging meaningful.
- The schema relations (`avatarAsset`, `voiceProfiles`, `storiesAsSubject`, `storiesAsSpeaker`) are confirmed present — there was no phantom relation problem, just the unsafe `(this.repo as any)` pattern.

**Defect introduced:** `StoryVisibility` is imported at line 13 of `StoryService.ts` but is now unused after the `visibility` field assignments were removed at lines 127 and 177. This is a dead import that will fail lint and break CI if lint runs as a build gate.

---

## Blocker 2 — HIGH: MUI Dialog Backdrop

**Verdict: Partial fix. One part is correct, one part introduces a new defect.**

The `slotProps` backdrop CSS added is:

```tsx
'&.MuiBackdrop-invisible': { pointerEvents: 'none' }
```

This selector targets the MUI "invisible" backdrop state — only active when `hideBackdrop={true}`. The bug described (backdrop lingering after close and blocking toolbar clicks) happens on a visible backdrop during the exit transition. This CSS does not address that scenario. It is harmless but ineffective.

`keepMounted={false}` is the MUI Dialog default, so adding it explicitly does nothing wrong but provides no additional fix.

**New defect introduced** — the 300ms `setTimeout` in `family-tree.tsx`:

```tsx
onClose={() => {
  setIsPersonModalOpen(false)
  fetchPeople()
  window.setTimeout(() => {
    setSelectedPersonId(null)
  }, 300)
}}
```

If a user closes modal A and within 300ms clicks a different tree node (which calls `setSelectedPersonId(newId)` and `setIsPersonModalOpen(true)`), the deferred timer fires and clears `selectedPersonId` to `null`. The modal is now open with a null `personId`, causing `PersonModal` to skip the fetch (`if (!personId) return`) and render the "Person not found" error state. This is a real race condition that regresses normal fast interactions.

---

## Blocker 3 — HIGH: PWA Icons Blocked by Auth

**Verdict: True fix.**

Adding `/icon-192.png`, `/icon-512.png`, `/favicon.ico`, `/robots.txt`, and `/sitemap.xml` to the `publicPaths` array in `proxy.ts` is the correct approach. The middleware matcher already intercepts these paths, so the public path whitelist is the right place to exempt them. The icon files are confirmed present in `UI/public/`.

**Note:** `/exports` was also added to `publicPaths` — this is not mentioned in the QA guide. Worth confirming that route should be unauthenticated before shipping.

---

## Blocker 4 — MEDIUM: Reset Password Infinite Spinner

**Verdict: True fix. Solid implementation.**

The `router.isReady` guard is the correct pattern for Next.js Pages Router — `router.query` is empty on the first SSR render and only populated after client-side hydration. The effect now waits for `router.isReady` before checking for the token, eliminating the infinite spinner.

The `Array.isArray(token) ? token[0] : token` normalization is also correct — Next.js query params can be `string | string[] | undefined` and this handles all three cases properly.

Minor: the same normalization logic is duplicated in `handleSubmit` at line 87. Not a bug, but worth extracting to avoid drift.

---

## Blocker 5 — MEDIUM: `/terms-legacy` Redirecting to Login

**Verdict: Partial fix. Functionally works, but inconsistently applied.**

`terms-legacy.tsx` re-exports `TermsOfLegacyPage` and `getServerSideProps` from `terms.tsx`. The route exists, is whitelisted in the proxy, and renders real content. The approach is pragmatic.

**Problem:** Only `reset-password.tsx` had its footer "Terms of Legacy" link updated to `/terms-legacy`. The following pages still have "Terms of Legacy" label text pointing at `/terms`:

- `UI/src/components/pages/LoginPage.tsx:411`
- `UI/src/components/pages/CreateAccountPage.tsx:472`
- `UI/src/pages/forgot-password.tsx:243`

**Secondary issue:** Both `/terms` and `/terms-legacy` serve identical content including the same `<title>Terms of Service - Heard Again</title>`. The legacy page has no distinct identity.

---

## Blocker 6 — MEDIUM: Billing `/api/billing/usage` Returns 404

**Verdict: Reasonable incremental fix, root cause unconfirmed.**

Moving `formatBytes` to `UI/src/lib/format.ts` is a legitimate refactor — the shared utility also incidentally fixes a latent out-of-bounds bug (adds `Math.min(..., sizes.length - 1)` to bound the index). However, the QA guide identified three possible root causes: a Vercel deployment issue, an import resolution failure, or a module-scope bug around `formatBytes`. Moving the function addresses only one of three hypotheses. There is no log evidence or test run confirming the 404 was caused by module scope rather than a deployment artifact.

The change is safe and improves code quality regardless of whether it resolves the 404.

---

## Blocker 7 — LOW: Copyright Year Hardcoded

**Verdict: Incomplete fix.**

Five files were updated to use `new Date().getFullYear()`. Two files were missed:

| File | Line | Current value |
|---|---|---|
| `UI/src/components/pages/LandingPage.tsx` | 536 | `© 2026 Heard Again.` |
| `UI/src/pages/privacy.tsx` | 389 | `© 2026 Heard Again.` |

Both will become stale in future years.

---

## Defects Introduced (by priority)

1. **Race condition in `family-tree.tsx`** — 300ms `setTimeout` in `onClose` can clear a newly-set `selectedPersonId` if a user opens a second modal within 300ms of closing the first. Modal opens showing "Person not found" error. (`UI/src/pages/family-tree.tsx:651`)

2. **Dead `StoryVisibility` import** — `StoryVisibility` imported but unused after `visibility` field removals. Will fail lint/CI. (`UI/src/services/StoryService.ts:13`)

3. **Incorrect CSS selector for backdrop fix** — `&.MuiBackdrop-invisible` targets `hideBackdrop` mode, not a lingering post-close backdrop. The stated problem may still be reproducible. (`UI/src/components/modals/PersonModal.tsx`)

4. **Incomplete copyright fix** — `LandingPage.tsx` and `privacy.tsx` still hardcoded.

5. **Inconsistent `terms-legacy` links** — 3 of 4 footer instances not updated.

6. **Unreviewed `/exports` public path** — Added to auth bypass list without corresponding issue in the QA guide.
