# Agent Lessons Learned

Derived from three code review sessions covering QA blocker fixes, an auth session split-brain fix, and a search/response-shape refactor.

---

## 1. Fix every trigger path, not just the one you found first

**What happened:** The auth session split-brain fix correctly guarded `fetchWithSessionHandling()` against premature redirects, but left `SessionErrorBoundary.componentDidCatch` — explicitly named as a second trigger path in the investigation doc — calling `redirectToLogin()` directly without the new guard. The fix was incomplete because only one of two confirmed entry points was updated.

**Rule:** When a bug has multiple confirmed trigger paths, treat the full list as a checklist. Do not close the issue until every path is guarded. Grep for all callers of the function being changed and verify each one.

---

## 2. Complete the scope you started — partial fixes create inconsistency debt

**What happened:** The copyright year fix updated 5 files but missed `LandingPage.tsx` and `privacy.tsx`. The `/terms-legacy` footer link fix updated `reset-password.tsx` but left `LoginPage.tsx`, `CreateAccountPage.tsx`, and `forgot-password.tsx` still pointing at `/terms` with "Terms of Legacy" label text. Each half-done fix left the codebase in an inconsistent state worse than doing nothing.

**Rule:** Before marking a task complete, grep for every instance of the pattern you are fixing. If you changed 5 files, verify there are not 7. Consistency across the codebase is part of the fix.

---

## 3. Don't introduce a race condition to solve a cosmetic timing problem

**What happened:** To prevent a perceived flicker when closing a modal, `setSelectedPersonId(null)` was deferred with a 300ms `setTimeout`. This created a race: if the user clicks a new tree node within 300ms of closing the modal, the timer fires and clears the newly-set `personId`, causing the modal to open in an error state.

**Rule:** When reaching for a timeout to fix a UI timing issue, ask: what happens if user action occurs during this window? A deferred state mutation that can overwrite a concurrent state update is a race condition. Prefer unmounting/remounting (structural) over timed cleanup (temporal).

---

## 4. Verify that a CSS selector targets the actual state you are fixing

**What happened:** The MUI Dialog backdrop fix applied `'&.MuiBackdrop-invisible': { pointerEvents: 'none' }`. This selector only activates when `hideBackdrop={true}` — the invisible-by-design state. The actual problem was a visible backdrop lingering during the exit transition. The CSS was syntactically valid and merged without error, but addressed a state the component never enters in the problematic scenario.

**Rule:** Before writing a CSS fix, confirm that the selector will actually match during the failure state. Check the MUI or library source for which class names are applied at which lifecycle stages. A CSS rule that never matches is silent dead code.

---

## 5. Don't add a JS filter after a database query that already filters

**What happened:** `PersonService.listPeople` was refactored to extract search token logic into helper functions. A JS `.filter(p => personMatchesNameSearch(p, tokens))` was then added after the Prisma query — which already applies the same search via `where.AND`. The database returned only matching rows; the JS filter re-checked them all again.

**Rule:** If a query already filters at the data source, do not add a second pass in application code doing the same work. Double-filtering implies the first filter is untrustworthy, adds a CPU pass per request, and misleads future readers. If there is a genuine reason for both (e.g. DB collation mismatch), document it explicitly.

---

## 6. Don't write a dead-code primary branch in a defensive fallback chain

**What happened:** Two places were updated to handle `/api/people` responses defensively:

```ts
const people = Array.isArray(data.data?.people)
  ? data.data.people                          // always false — API never returns this shape
  : (Array.isArray(data.data) ? data.data : [])
```

The API returns `{ success: true, data: PersonListItem[] }` — a flat array, never `{ data: { people: [...] } }`. Every other caller in the codebase reads `data.data` directly. The `data.data.people` branch is permanently dead code that makes the response shape look ambiguous to future readers.

**Rule:** When writing defensive code to handle multiple response shapes, first verify which shapes actually exist. Dead primary branches are harder to reason about than a straightforward check. If only one shape is real, write for that shape. Defensive code should protect against real variance, not imagined variance.

---

## 7. Remove the import when you remove the usage

**What happened:** `visibility` field assignments were removed from `StoryService.ts`, but the `StoryVisibility` import at the top of the file was left behind. TypeScript strict mode and ESLint both flag unused imports. The dead import would have failed CI lint checks.

**Rule:** When removing code, always check whether the imports it depended on are now orphaned. A removed usage without a removed import is an incomplete edit. Check at minimum the top of the file after any deletion.

---

## 8. Don't add unrelated changes to a focused fix

**What happened:** While fixing PWA icon auth bypass, `/exports` was added to the public (unauthenticated) paths list in `proxy.ts`. This was not mentioned in the QA guide, had no corresponding issue, and may have security implications for a route that serves user data.

**Rule:** Keep a fix scoped to what the issue describes. If you identify a related gap while working, note it separately rather than silently bundling it into a different fix. Reviewers cannot evaluate what they cannot see.

---

## 9. Name tests for what they actually assert

**What happened:** A test named "confirms the real session before redirecting on fetch 401" mocked the session endpoint to return `{}` (no user), meaning `isActuallyUnauthenticated()` returned `true` and the redirect fired. The test was actually exercising the "redirect happens when truly unauthenticated" path. Its name implied the opposite — that it was verifying the skip-redirect guard.

**Rule:** Name tests for the specific outcome they assert, not the mechanism they exercise. "Does not redirect when session is valid" and "redirects when session is confirmed gone" are two distinct behaviors that need two distinct test names and two distinct assertions. A test named for architecture but asserting an outcome creates a false sense of coverage.

---

## 10. Fix the root cause in the right place, not the nearest convenient place

**What happened:** `family-tree.tsx` had a pre-existing bug: `data.data?.people` was always `undefined` because the API returns a flat array. The fix applied a defensive fallback chain (`data.data?.people ?? data.data ?? []`) rather than the simple correct form (`Array.isArray(data.data) ? data.data : []`) used by every other caller. The fix worked but preserved the misleading shape assumption.

**Rule:** When fixing a bug caused by a wrong assumption about data shape, correct the assumption — don't wrap it in a fallback that hides it. Look at how other callers in the codebase consume the same data and align with the established pattern. A fix that works by coincidence is not the same as a fix that works by design.
