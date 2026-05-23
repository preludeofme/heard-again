# Auth Session Split-Brain Fix Review

**Date:** 2026-05-23
**Reviewer:** Claude Code
**Scope:** Changes to `UI/src/lib/session-handler.ts` and `UI/src/__tests__/lib/session-handler.test.ts` against the root cause identified in `docs/auth-session-split-brain-investigation.md`.

---

## Summary

| Area | Verdict |
|---|---|
| `clearAuthData()` cookie deletion removed | True fix — root cause addressed |
| `isActuallyUnauthenticated()` guard added | True fix — correct implementation |
| `fetchWithSessionHandling()` 401 path | True fix — guard correctly applied |
| `SessionErrorBoundary.componentDidCatch` | **Not fixed** — identified trigger path left unchanged |
| `handleApiError()` | New/unchanged exported function bypasses the guard |
| Test coverage | Structurally correct, missing the confirmed second trigger path |

---

## What was fixed

### `clearAuthData()` — correct

The cookie deletion loop was removed. The function now only clears app-owned localStorage entries. This is the minimal, correct change. JavaScript cannot delete HttpOnly cookies, so the loop was only ever capable of damaging client-visible helper cookies — exactly the mechanism causing the split-brain state.

### `isActuallyUnauthenticated()` — correct

The guard function calls `/api/auth/session` before any redirect decision and only returns `true` when the endpoint fails or returns no `session.user`. The implementation is sound: network errors default to `true` (safe-fail toward redirect, not toward silent swallow), and the logger call on failure preserves observability.

### `fetchWithSessionHandling()` 401 path — correct

Both the HTTP 401 path and the `isSessionExpiredError()` throw path now gate on `isActuallyUnauthenticated()` before calling `redirectToLogin()`. This directly fixes the stated case where an endpoint-level 401 (e.g. a resource the user lacks permission to access) was poisoning global client session state.

---

## What was not fixed

### `SessionErrorBoundary.tsx` — trigger path left open

The investigation doc explicitly names this as a trigger path:

> *The error boundary also calls `redirectToLogin()` when an error matches `isSessionExpiredError()`*

The current code in `UI/src/components/auth/SessionErrorBoundary.tsx` at line 42-44 is unchanged:

```ts
if (isSessionExpiredError(error)) {
  this.setState({ isRedirecting: true })
  redirectToLogin()   // ← no isActuallyUnauthenticated() check
}
```

`redirectToLogin()` calls `clearAuthData()` (now safe) but still immediately navigates away without verifying the NextAuth session. If a React render error is caught by the boundary and the error happens to contain `statusCode: 401`, the message string `"Authentication required"`, or similar, the user will be redirected to login even if their server session is fully valid.

This boundary is mounted at the root in `_app.tsx` and wraps the entire app. The fix to `fetchWithSessionHandling` is meaningless if a throw in a component can reach this boundary and trigger the same pre-fix behavior.

---

## New defect: `handleApiError()` bypasses the guard

`handleApiError()` at line 166 is an exported function that still calls `redirectToLogin()` directly:

```ts
export function handleApiError(error: any, currentPath?: string): void {
  if (isSessionExpiredError(error)) {
    redirectToLogin(currentPath)  // ← no isActuallyUnauthenticated() check
    return
  }
  logger.error('API Error:', error)
}
```

`isSessionExpiredError()` returns `true` for `error.statusCode === 401`, `error.code === 'UNAUTHORIZED'`, and several message patterns. `handleApiError` has no callers in the current codebase, but it is exported and tested — it is part of the module's public API. Any future caller passing a structured 401 error will immediately redirect without session verification, reproducing the original split-brain issue through a different code path.

---

## Test coverage gaps

### Test: "confirms the real session before redirecting on fetch 401"

```ts
fetchMock
  .mockResolvedValueOnce(mockResponse('denied', 401))
  .mockResolvedValueOnce(mockResponse({}, 200))  // empty body = no session.user
```

The session mock returns `{}` (no `user` field), so `isActuallyUnauthenticated()` returns `true`. This test exercises the **redirect-does-happen** path, not the **redirect-is-skipped** path. The test name implies it is verifying the guard architecture, but both this test and the "does not globally redirect" test share the same concern from different angles. There is no assertion confirming that `redirectToLogin()` was actually called in this case — the test only verifies that `fetch` was called twice.

### Missing tests

- No test covers `SessionErrorBoundary.componentDidCatch` with a session-expired error — the unfixed trigger path has no regression coverage.
- No test covers `handleApiError` with a 401-structured error — the only test for it uses a 403 and confirms the happy path.
- No test verifies that the redirect path in `fetchWithSessionHandling` (when `isActuallyUnauthenticated()` returns `true`) actually calls `redirectToLogin()`. The redirect fires, but it throws a jsdom "not implemented" warning and the test passes without asserting on the navigation.

---

## Secondary issue: `isRedirecting` flag never resets from non-hook paths

`isRedirecting` is a module-level flag set to `true` inside `redirectToLogin()` and reset to `false` inside `useSessionExpiration()`'s `useEffect` on component mount. This means:

- If `redirectToLogin()` is triggered from `fetchWithSessionHandling`, `handleApiError`, or `SessionErrorBoundary` (all of which run outside the hook), the flag stays `true` permanently until a component using `useSessionExpiration()` mounts.
- In the error boundary path specifically, a failed redirect (e.g. jsdom or a partially broken navigation environment) locks the flag indefinitely, silently dropping all subsequent 401s in the same session.

This was pre-existing behavior, not introduced by this fix, but the new async guard path (`await isActuallyUnauthenticated()`) adds a brief window between the guard check and `redirectToLogin()` where a second concurrent 401 might slip through before the flag is set.

---

## Tests pass

```
Tests: 4 passed, 4 total
```

The jsdom "not implemented" warning on `window.location.href` in the third test is expected and noted in the investigation doc. Tests pass.

---

## Defects ranked by severity

| # | Location | Description |
|---|---|---|
| 1 | `SessionErrorBoundary.tsx:44` | Confirmed trigger path not updated — `redirectToLogin()` called without session verification |
| 2 | `session-handler.ts:168` | `handleApiError()` bypasses the `isActuallyUnauthenticated()` guard for any 401-matching error |
| 3 | `session-handler.test.ts:71` | "confirms the real session" test name is misleading — it tests the redirect path, not the skip-redirect path, and does not assert the redirect occurred |
| 4 | `session-handler.ts:14,102` | `isRedirecting` flag has no reset path from non-hook callers — persistent lock after any redirect from the error boundary or `handleApiError` |

---

## Recommended follow-up

1. Update `SessionErrorBoundary.componentDidCatch` to call `isActuallyUnauthenticated()` before `redirectToLogin()`. Since `componentDidCatch` is synchronous in React's lifecycle, this requires converting the check to async or deferring the redirect (e.g. `Promise.resolve().then(() => isActuallyUnauthenticated().then(...))`).

2. Update `handleApiError()` to also gate on `isActuallyUnauthenticated()`, or deprecate it since it has no callers.

3. Add a test that covers the `SessionErrorBoundary` trigger path.


## Review gaps resolved

**Resolved:** 2026-05-23T16:14:29-05:00  
**Assessment reviewed:** `docs/auth-session-fix-review.md`

Follow-up fixes were applied for the gaps identified in the review.

### Additional code changes

1. `SessionErrorBoundary.tsx` now verifies the canonical NextAuth session before redirecting.
   - The boundary still detects session-shaped errors with `isSessionExpiredError(error)`.
   - It now calls `isActuallyUnauthenticated()` first.
   - It only sets `isRedirecting` and calls `redirectToLogin()` when `/api/auth/session` confirms there is no `session.user`.

2. `handleApiError()` now uses the same guard.
   - The function is now async and returns `Promise<void>`.
   - Structured 401/session-shaped errors no longer redirect immediately.
   - The function redirects only after `isActuallyUnauthenticated()` confirms the user is actually unauthenticated.
   - Current codebase search confirms there are no production callers of `handleApiError()` at this time, so the async signature does not require downstream production updates.

3. `redirectToLogin()` now returns the computed login URL.
   - Runtime navigation behavior is unchanged outside tests.
   - In `NODE_ENV === 'test'`, it returns the login URL instead of trying to perform jsdom navigation.
   - This removes reliance on jsdom's "navigation not implemented" warning and allows tests to assert redirect intent directly.

### Additional regression coverage

Added:

```text
UI/src/__tests__/components/auth/SessionErrorBoundary.test.ts
```

Expanded:

```text
UI/src/__tests__/lib/session-handler.test.ts
```

Coverage now includes:

- `SessionErrorBoundary` does not redirect on a session-shaped error while `/api/auth/session` still has a user.
- `SessionErrorBoundary` redirects only after `/api/auth/session` confirms no user.
- `handleApiError()` does not redirect on structured 401 while the NextAuth session is still valid.
- `handleApiError()` redirects when structured 401 is confirmed unauthenticated.
- Fetch 401 redirect path asserts the computed login URL directly instead of relying on jsdom navigation warnings.

### Verification after follow-up

```bash
cd /home/trubuck-design/Projects/Personal/heard-again/UI
npm test -- --runInBand src/__tests__/lib/session-handler.test.ts src/__tests__/components/auth/SessionErrorBoundary.test.ts
```

Result: `PASS` — 8 tests passed across 2 suites.

```bash
cd /home/trubuck-design/Projects/Personal/heard-again/UI
npm run typecheck
```

Result: `PASS` — `tsc --noEmit` exited `0`.

### Lesson learned

The assessment was correct: fixing only the obvious fetch wrapper path was incomplete. For auth/session bugs, every exported helper and root-level boundary that can call global redirect/logout must share the same session-verification gate, even if a path has no current production callers. Regression tests should cover all trigger paths named in the investigation, not just the first implementation target.
