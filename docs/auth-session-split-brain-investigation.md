# Auth Session Split-Brain Investigation

**Date:** 2026-05-23T14:22:35-05:00  
**Project:** Heard Again  
**Repo:** `/home/trubuck-design/Projects/Personal/heard-again`

## Reported symptom

After logging in and navigating around the app, the UI initially shows the user as logged in via the avatar in the top-right account menu. After some time or after some navigation/action, the top-right account area starts showing the user as not logged in, usually as a **Sign In** button.

At the same time, authenticated areas such as the family page / family tree can still be used and continue to fetch data successfully.

## Short conclusion

The app appears to be entering a **client/server auth split-brain state**:

- The top-right avatar is driven by the client-side NextAuth `useSession()` state.
- Family data pages call app API routes that authenticate server-side using `getServerSession()`.
- A custom session-expiration helper can clear client-visible cookies broadly without actually clearing the HttpOnly NextAuth session token.

That can make the client-side session appear unauthenticated while server-side API routes still see a valid auth session.

## Relevant files

### Header/account UI

```text
UI/src/components/layout/Layout.tsx
```

The account menu is rendered by `UserMenu()`:

```tsx
const { data: session, status } = useSession()

if (status === 'loading') return <Avatar sx={{ width: 32, height: 32 }} />

if (!session?.user) {
  return (
    <Button component={Link} href="/login" variant="contained" size="small" sx={{ ml: 1 }}>
      Sign In
    </Button>
  )
}
```

Therefore, the top-right avatar depends entirely on client-side NextAuth session state.

### App-level session provider

```text
UI/src/components/auth/AuthProvider.tsx
UI/src/pages/_app.tsx
```

`_app.tsx` passes any page-provided session into the `AuthProvider`:

```tsx
const { session, ...restPageProps } = pageProps

<AuthProvider session={session}>
  ...
</AuthProvider>
```

`AuthProvider` wraps NextAuth's `SessionProvider`:

```tsx
export function AuthProvider({ children, session }: AuthProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
```

Most pages in this app return an empty `getServerSideProps()` payload, so the client often relies on NextAuth's client fetch to `/api/auth/session` rather than receiving a server-hydrated session.

### NextAuth config

```text
UI/src/lib/auth.ts
UI/src/pages/api/auth/[...nextauth].ts
```

The app uses JWT sessions:

```ts
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 1 day
},
```

The session callback populates user fields from the JWT token:

```ts
async session({ session, token }) {
  if (token && session.user) {
    session.user.id = token.id as string
    session.user.email = token.email
    session.user.displayName = (token.displayName as string) || null
    session.user.avatarUrl = (token.avatarUrl as string) || null
    session.user.defaultFamilyspaceId = (token.defaultFamilyspaceId as string) || null
    session.user.linkedPersonId = (token.linkedPersonId as string) || null
    session.user.role = (token.role as string) || 'VIEWER'
  }
  return session
}
```

### Family tree page/API data flow

```text
UI/src/pages/family-tree.tsx
UI/src/pages/api/people/family-tree.ts
UI/src/lib/auth-helpers.ts
```

The family tree page uses `useSession()` for some UI/session-derived values:

```tsx
const { data: session } = useSession()
const familyspaceId = session?.user?.defaultFamilyspaceId
```

But its main data fetches go directly to API routes with cookies included:

```tsx
fetch('/api/people?limit=500', { credentials: 'include' })

fetch(`/api/people/family-tree?depthUp=${depths.up}&depthDown=${depths.down}&includeSiblings=${siblings}${rootParam}${expandUpParam}${expandDownParam}${expandSiblingsParam}`, {
  credentials: 'include',
})
```

The family-tree API route authenticates server-side:

```ts
const user = await getAuthUserWithFamilyspace(req, res)
```

`getAuthUserWithFamilyspace()` calls `getAuthUser()`, which uses:

```ts
const session = await getServerSession(req, res, authOptions)
```

This explains how family APIs can continue to work even if the client `useSession()` state is stale or unauthenticated.

## Primary suspect

```text
UI/src/lib/session-handler.ts
```

The custom session handler has this function:

```ts
export function clearAuthData(): void {
  // Clear session cookies (client-side only)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=')
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  })
  
  // Clear localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('heard-again:recent-searches')
    localStorage.removeItem('heard-again:preferences')
  }
}
```

`redirectToLogin()` calls this function before redirecting:

```ts
export function redirectToLogin(currentPath?: string): void {
  if (isRedirecting) return
  
  isRedirecting = true
  clearAuthData()
  
  const loginUrl = currentPath 
    ? `/login?callbackUrl=${encodeURIComponent(currentPath)}`
    : '/login'
  
  if (typeof window !== 'undefined') {
    window.location.href = loginUrl
  }
}
```

This is risky because it attempts to delete every client-visible cookie for the path. JavaScript cannot delete HttpOnly cookies, so the true NextAuth session cookie may remain valid while client-visible helper cookies are deleted.

Possible affected cookies include:

- NextAuth callback/CSRF helper cookies
- app `csrf-token`
- any future non-HttpOnly app/session helper cookie

This can damage client-side auth/session behavior without fully logging the user out server-side.

## Trigger paths

A single 401 response or auth-looking error can trigger the custom redirect/clear path.

### `fetchWithSessionHandling()`

```text
UI/src/lib/session-handler.ts
```

```ts
export async function fetchWithSessionHandling(
  url: string,
  options: RequestInit = {},
  currentPath?: string
): Promise<Response> {
  try {
    const response = await fetch(url, options)
    
    // Check for 401 Unauthorized response
    if (response.status === 401) {
      redirectToLogin(currentPath)
      return response
    }
    
    return response
  } catch (error: any) {
    // Check if error indicates session expiration
    if (isSessionExpiredError(error)) {
      redirectToLogin(currentPath)
      throw error
    }
    
    throw error
  }
}
```

### API client

```text
UI/src/lib/api-client.ts
```

`fetchWithCSRF()` always routes through `fetchWithSessionHandling()`:

```ts
return fetchWithSessionHandling(url, options)
```

This means a 401 from a CSRF-protected/state-changing request can immediately trigger client cookie clearing and redirect behavior.

### Error boundary

```text
UI/src/components/auth/SessionErrorBoundary.tsx
```

The error boundary also calls `redirectToLogin()` when an error matches `isSessionExpiredError()`:

```ts
if (isSessionExpiredError(error)) {
  this.setState({ isRedirecting: true })
  redirectToLogin()
}
```

## Why the family page can still work

The family tree API uses server-side session validation:

```text
UI/src/pages/api/people/family-tree.ts
UI/src/lib/auth-helpers.ts
```

Server-side validation reads the real request cookies and calls `getServerSession()`.

If the HttpOnly NextAuth token remains valid, the server sees the user as authenticated even if the browser-side React session state has become unauthenticated.

This matches the observed behavior:

```text
Top-right account menu: Sign In
Family tree API: still returns data
```

## Secondary issue: protected pages do not consistently gate on session status

The family tree page uses `useSession()` but does not wait for `status === 'authenticated'` before fetching its main data.

```tsx
const { data: session } = useSession()
const familyspaceId = session?.user?.defaultFamilyspaceId
```

Main data fetches run independently:

```tsx
useEffect(() => {
  fetchPeople({ up: 2, down: 2 }, undefined, false)
  fetchSearchablePeople()
}, [fetchPeople, fetchSearchablePeople])
```

This allows the page to continue operating via server-authenticated API calls even if `useSession()` is loading, stale, or marked unauthenticated.

This is not necessarily the root cause, but it makes the split-brain state visible and persistent.

## Verification already run

Command:

```bash
cd /home/trubuck-design/Projects/Personal/heard-again/UI
npm run typecheck
```

Result:

```text
> heard-again@1.0.0 typecheck
> tsc --noEmit
```

Exit code: `0`

## Suggested browser-side confirmation

When the issue appears, run these in browser devtools:

```js
await fetch('/api/auth/session').then(r => r.json())
```

Then:

```js
await fetch('/api/people/family-tree?depthUp=2&depthDown=2&includeSiblings=false', {
  credentials: 'include'
}).then(async r => ({ status: r.status, ok: r.ok, body: await r.text() }))
```

And inspect client-visible cookies:

```js
document.cookie
```

The split-brain hypothesis is confirmed if:

- `/api/auth/session` returns no user or unauthenticated session data.
- `/api/people/family-tree...` still returns `200` and valid family data.
- `document.cookie` shows client-visible auth/helper cookies changed or missing after the problematic step.

## Recommended fix

### 1. Stop deleting all cookies client-side

Replace `clearAuthData()` with a version that only clears app-local non-auth state:

```ts
export function clearAuthData(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('heard-again:recent-searches')
    localStorage.removeItem('heard-again:preferences')
  }
}
```

Do not manually delete NextAuth cookies from application code. Let NextAuth handle logout via `signOut()`.

### 2. Do not redirect/wipe auth state on every arbitrary API 401

Instead of immediately calling `redirectToLogin()` in `fetchWithSessionHandling()`, confirm that the NextAuth session is truly gone.

Conceptual approach:

```ts
if (response.status === 401) {
  const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
  const session = await sessionRes.json().catch(() => null)

  if (!session?.user) {
    redirectToLogin(currentPath)
  }

  return response
}
```

This prevents unrelated endpoint authorization failures from corrupting the global client session state.

### 3. Gate protected pages on `useSession().status`

For pages like `family-tree.tsx`, use:

```tsx
const { data: session, status } = useSession()

useEffect(() => {
  if (status !== 'authenticated') return
  fetchPeople({ up: 2, down: 2 }, undefined, false)
  fetchSearchablePeople()
}, [status, fetchPeople, fetchSearchablePeople])
```

This will reduce UI/API state divergence and make session problems fail consistently instead of partially.

## Minimal next change

The safest first code change is to remove the cookie-deletion loop from `clearAuthData()`.

That is low risk because:

- Explicit logout already uses NextAuth `signOut()` in `UI/src/components/layout/Layout.tsx`.
- JavaScript cannot reliably clear HttpOnly session cookies anyway.
- Clearing all visible cookies can break CSRF/session helper state.

## Files most likely to change

```text
UI/src/lib/session-handler.ts
UI/src/lib/api-client.ts
UI/src/pages/family-tree.tsx
```

Recommended first patch:

```text
UI/src/lib/session-handler.ts
```

Remove the `document.cookie.split(';').forEach(...)` block from `clearAuthData()`.


## Resolution implemented

**Resolved:** 2026-05-23T14:29:20-05:00  
**Project:** Heard Again  
**Repo:** `/home/trubuck-design/Projects/Personal/heard-again`

The minimal root-cause fix has now been applied in:

```text
UI/src/lib/session-handler.ts
UI/src/__tests__/lib/session-handler.test.ts
```

### Code changes

1. `clearAuthData()` no longer deletes browser cookies.
   - Removed the broad `document.cookie.split(';').forEach(...)` expiration loop.
   - The function now only clears app-owned localStorage keys:
     - `heard-again:recent-searches`
     - `heard-again:preferences`
   - This prevents client-side code from deleting visible NextAuth/helper cookies while leaving the HttpOnly server session alive.

2. Added `isActuallyUnauthenticated()`.
   - It checks the canonical NextAuth endpoint:

```ts
fetch('/api/auth/session', { credentials: 'include' })
```

   - It only returns unauthenticated when the endpoint fails or returns no `session.user`.

3. Updated `fetchWithSessionHandling()` 401 handling.
   - A `401` from an arbitrary app endpoint no longer immediately triggers `redirectToLogin()`.
   - The code first verifies `/api/auth/session`.
   - If the NextAuth session still has a user, the original `401` response is returned without global redirect or auth cleanup.
   - If the NextAuth session has no user, the user is redirected to login as before.

### Regression coverage added

A new Jest test file was added:

```text
UI/src/__tests__/lib/session-handler.test.ts
```

It covers:

- `clearAuthData()` preserves browser-visible cookies while clearing app-local localStorage.
- A protected endpoint `401` does not globally redirect when `/api/auth/session` still has a user.
- The fetch wrapper checks `/api/auth/session` before deciding whether to redirect.
- Non-session authorization errors, such as `403`, are not treated as session expiration.

### Verification run after fix

Targeted regression test:

```bash
cd /home/trubuck-design/Projects/Personal/heard-again/UI
npm test -- --runInBand src/__tests__/lib/session-handler.test.ts
```

Result: `PASS` — 4 tests passed.

TypeScript check:

```bash
cd /home/trubuck-design/Projects/Personal/heard-again/UI
npm run typecheck
```

Result: `PASS` — `tsc --noEmit` exited `0`.

### Notes

The Jest run logs a jsdom warning when the unauthenticated branch assigns `window.location.href`; this is expected because jsdom does not implement real navigation. The test still passes and confirms the guard behavior before redirect.

The remaining optional hardening is to gate protected pages such as `family-tree.tsx` on `useSession().status === 'authenticated'`. That is not required for the root-cause fix, but it would make UI/API session state less divergent in future flows.


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
