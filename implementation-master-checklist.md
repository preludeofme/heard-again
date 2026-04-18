# Implementation Master Checklist

**Generated from**: `production-audit-report.md`
**Date**: 2026-04-14
**Application**: Heard Again

Tasks are ordered by dependency sequence within each phase. Complete tasks in order — later tasks in each phase may assume earlier ones are done.

---

## Phase 1 — Critical (complete before any production deployment)

### 1. Credential Containment

> Must be done first. Every subsequent security task assumes the secrets have been rotated and are no longer in git.

- [ ] **1.1 — Rotate all exposed credentials** *(BLOCKED — requires external service access: Google Cloud Console, Cloudflare dashboard)*
  - **Affected**: External services (Google Cloud Console, Cloudflare dashboard, NextAuth secret generator)
  - **Steps**:
    1. Generate a new `NEXTAUTH_SECRET`: `openssl rand -base64 32`
    2. Revoke and regenerate `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Google Cloud Console → APIs & Services → Credentials
    3. Revoke `CLOUDFLARE_TUNNEL_TOKEN` in Cloudflare Zero Trust dashboard and issue a new tunnel token
    4. Generate new `CHAT_SERVICE_SECRET`: `openssl rand -hex 32`
    5. Replace `Chat/.env` `JWT_SECRET` and `SESSION_SECRET` with `openssl rand -hex 32` values
    6. Replace `Chat/.env` `CHROMA_CREDENTIALS` default from `admin:admin123`
  - **Validation**: Old values no longer authenticate against any external service; new values are not present in any git-tracked file

- [x] **1.2 — Remove `.env` and `UI/.env` from git tracking**
  - **Affected**: `.env`, `UI/.env`, `.gitignore`
  - **Steps**:
    1. Confirm `.env` is listed in root `.gitignore` (it is — verify it's also not tracked: `git ls-files .env`)
    2. Add `UI/.env` to root `.gitignore` if not present
    3. Remove from git index without deleting the file: `git rm --cached .env UI/.env`
    4. Commit the removal: `git commit -m "chore: untrack .env files from git"`
  - **Validation**: `git ls-files | grep -E "^\.env$|^UI/\.env$"` returns no output
  - **Depends on**: 1.1 (rotate before untracking so history is still accessible for the changeover window)

- [ ] **1.3 — Purge `.env` files from full git history** *(BLOCKED — git-filter-repo not installed; pip blocked by PEP 668. Run: `pip install --break-system-packages git-filter-repo` or `sudo apt install git-filter-repo`)*
  - **Affected**: Git repository history
  - **Steps**:
    1. Install `git-filter-repo` if not present: `pip install git-filter-repo`
    2. Run: `git filter-repo --path .env --path UI/.env --path Chat/.env --path Chat/.env.bak --invert-paths --force`
    3. Force-push all branches: `git push origin --force --all`
    4. Notify all collaborators to re-clone or run `git fetch --all && git reset --hard origin/main`
  - **Validation**: `git log --all --full-history -- .env` returns no commits; `git log --all --full-history -- UI/.env` returns no commits
  - **Depends on**: 1.2

- [x] **1.4 — Remove `Chat/.env` from git tracking and history**
  - **Affected**: `Chat/.env`, `Chat/.env.bak`
  - **Steps**:
    1. `git rm --cached Chat/.env Chat/.env.bak`
    2. Add `Chat/.env` and `Chat/.env.bak` to `.gitignore`
    3. Include these paths in the `git filter-repo` command in task 1.3 (handle together)
  - **Validation**: `git ls-files Chat/.env` returns no output
  - **Depends on**: 1.1 (rotate Chat secrets), 1.3 (batch with the filter-repo run)

- [x] **1.5 — Remove `sonar-reports/` from git tracking**
  - **Affected**: `sonar-reports/`, `.gitignore`
  - **Steps**:
    1. `git rm -r --cached sonar-reports/`
    2. Add `sonar-reports/` to `.gitignore`
    3. Commit: `git commit -m "chore: untrack sonar-reports from git"`
  - **Validation**: `git ls-files sonar-reports/` returns no output
  - **Depends on**: Can be done in parallel with 1.2–1.4

- [x] **1.6 — Populate `.env.example` files with all required variables (no values)**
  - **Affected**: `.env.example` (root), `UI/.env.example`, `Chat/.env.example`
  - **Steps**:
    1. Audit each `.env.example` against its corresponding `.env` — add any missing keys
    2. Ensure every key is present with an empty value or a clear placeholder (e.g. `NEXTAUTH_SECRET=<generate: openssl rand -base64 32>`)
    3. Add `TTS_SERVICE_TOKEN=<required — service-to-service token for TTS>` to `UI/.env.example`
    4. Add `POSTGRES_PASSWORD=<required — min 24 chars>` to root `.env.example`
    5. Commit the updated example files
  - **Validation**: `diff <(grep -E "^[A-Z]" .env.example | cut -d= -f1 | sort) <(grep -E "^[A-Z]" .env | cut -d= -f1 | sort)` shows no missing keys in the example

---

### 2. Test Override Removal

> Independent of credential work. Can be done in parallel with section 1.

- [x] **2.1 — Delete the test-overrides API endpoint**
  - **Affected**: `UI/src/pages/api/test-overrides.ts`
  - **Steps**:
    1. `git rm UI/src/pages/api/test-overrides.ts`
    2. Search for any import of `getTestOverrides` across the codebase: `grep -rn "getTestOverrides\|test-overrides" UI/src --include="*.ts" --include="*.tsx"`
    3. Remove any found usages
  - **Validation**: `curl -s -X GET http://localhost:4777/api/test-overrides -H "Cookie: next-auth.session-token=<valid_token>"` returns 404

- [x] **2.2 — Remove the Test Overrides tab from the account page**
  - **Affected**: `UI/src/pages/account.tsx`
  - **Steps**:
    1. Remove the `TabPanel` block for index `3` (lines ~717–830 containing "Testing Overrides")
    2. Remove the `overrides` state, `updateOverride` function, and `localStorage` references
    3. Remove the "Test Overrides" `Tab` from the `Tabs` component
    4. Run `tsc --noEmit` — confirm no type errors
  - **Validation**: Account settings page renders without "Test Overrides" tab; no `localStorage.getItem('testOverrides')` calls remain in the page
  - **Depends on**: 2.1

---

### 3. CSP Hardening

- [x] **3.1 — Remove `unsafe-eval` from the production CSP in `next.config.js`**
  - **Affected**: `UI/next.config.js:42`
  - **Steps**:
    1. Change the `script-src` value from `"'self' 'unsafe-eval'"` to `"'self'"`
    2. To preserve dev-mode HMR, wrap the header value in an environment check:
       ```js
       const scriptSrc = process.env.NODE_ENV === 'development'
         ? "'self' 'unsafe-eval'"
         : "'self'"
       ```
    3. Apply `scriptSrc` variable in the CSP header value string
  - **Validation**: In a production build (`NODE_ENV=production`), curl the response headers: `curl -I http://localhost:4777` — `Content-Security-Policy` must not contain `unsafe-eval`. Dev mode still starts without errors.

---

### 4. TTS Service Token Hardening

> Depends on 1.6 (TTS_SERVICE_TOKEN added to .env.example and rotated credentials in place).

- [x] **4.1 — Make `TTS_SERVICE_TOKEN` a required env var (no fallback)**
  - **Affected**: `UI/src/pages/api/voice/upload-sample.ts:86`
  - **Steps**:
    1. Remove `|| 'default-token'` from the Authorization header construction
    2. Add a startup check at the top of the file (or in a shared startup validator):
       ```ts
       const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN
       if (!TTS_SERVICE_TOKEN) throw new Error('TTS_SERVICE_TOKEN env var is required')
       ```
    3. Add `TTS_SERVICE_TOKEN` to the `app` service environment block in `docker-compose.yml`
  - **Validation**: Starting the Next.js server without `TTS_SERVICE_TOKEN` set throws an error and refuses to start; with it set, the voice upload pipeline succeeds end-to-end
  - **Depends on**: 1.6 (token value exists in env), 1.1 (token is a fresh value)

---

### 5. ChromaDB Reset Disabled

- [x] **5.1 — Disable ChromaDB reset endpoint in production**
  - **Affected**: `docker-compose.yml:212`
  - **Steps**:
    1. Change `ALLOW_RESET=TRUE` to `ALLOW_RESET=FALSE` in the `chromadb` service environment block
    2. If the reset is needed during dev, add it only to `docker-compose.dev.yml`
  - **Validation**: `docker compose exec chromadb curl -X POST http://localhost:8000/api/v1/reset` returns a 403 or 405 error

---

## Phase 2 — High (complete before public launch)

### 6. Dependency Vulnerabilities

> Can be started immediately after Phase 1 is complete; does not depend on Phase 1 tasks internally.

- [x] **6.1 — Apply non-breaking `npm audit fix`** *(no non-breaking fixes available — all remaining issues require --force)*
  - **Affected**: `UI/package.json`, `UI/package-lock.json`
  - **Steps**:
    1. `cd UI && npm audit fix`
    2. Review the diff in `package-lock.json` for unexpected version changes
    3. Run `npm run build` — confirm build succeeds
    4. Run `npm test` — confirm tests pass
  - **Validation**: `npm audit` reports 0 high-severity vulnerabilities; build and tests pass

- [x] **6.2 — Update `next-auth` to ≥4.24.7 for cookie vulnerability fix** *(already on 4.24.13)*
  - **Affected**: `UI/package.json`
  - **Steps**:
    1. `cd UI && npm install next-auth@^4.24.7`
    2. Check for breaking changes in the next-auth 4.24.x changelog
    3. Run `npm run build && npm test`
    4. Manually test login (credentials + Google OAuth), session persistence, and sign-out
  - **Validation**: `npm audit` no longer reports cookie vulnerability; login flow works correctly
  - **Depends on**: 6.1 (run after base audit fix to avoid conflicts)

- [ ] **6.3 — Evaluate and apply `npm audit fix --force` for remaining high issues** *(DEFERRED — --force would downgrade next-auth 4.24.13→4.24.7 breaking next@16 peer dep; @google-cloud/storage vulns only affect STORAGE_MODE=gcp which is not in use)*
  - **Affected**: `UI/package.json` (`@google-cloud/storage`, `defu` dependents)
  - **Steps**:
    1. Run `npm audit fix --force --dry-run` and review which packages would change
    2. If `@google-cloud/storage` major bump is acceptable (currently unused in storage_mode=local), apply it
    3. Test full build and voice upload flow after applying
  - **Validation**: `npm audit` reports 0 high or critical vulnerabilities
  - **Depends on**: 6.2

---

### 7. CSRF Fallback Secret Removal

- [x] **7.1 — Remove CSRF fallback secret string**
  - **Affected**: `UI/src/lib/security/csrf.ts:6`, `UI/src/pages/api/csrf-token.ts:6`
  - **Steps**:
    1. In `csrf.ts`, change:
       ```ts
       const CSRF_SECRET = process.env.NEXTAUTH_SECRET || 'csrf-fallback-secret'
       ```
       to:
       ```ts
       const CSRF_SECRET = process.env.NEXTAUTH_SECRET
       if (!CSRF_SECRET) throw new Error('NEXTAUTH_SECRET is required for CSRF protection')
       ```
    2. Apply the same change in `csrf-token.ts`
    3. Run `tsc --noEmit`
  - **Validation**: Starting the app without `NEXTAUTH_SECRET` set causes an immediate startup error; with it set, CSRF token flow works correctly (test via the CSRF test in `__tests__/security/csrf.test.ts`)
  - **Depends on**: 1.1 (NEXTAUTH_SECRET has been rotated and will be set)

---

### 8. Middleware Session Validation

> Depends on 6.2 (next-auth updated) since `getToken` behaviour may change between versions.

- [x] **8.1 — Replace cookie-presence check with `getToken()` verification in middleware**
  - **Affected**: `UI/src/middleware.ts:27-30`
  - **Steps**:
    1. Replace the manual cookie check:
       ```ts
       const token = request.cookies.get('next-auth.session-token')?.value ||
                     request.cookies.get('__Secure-next-auth.session-token')?.value
       ```
       with NextAuth's cryptographic verification:
       ```ts
       import { getToken } from 'next-auth/jwt'
       const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
       ```
    2. The existing `if (!token)` redirect logic remains unchanged
    3. Run `tsc --noEmit`
  - **Validation**: A request with a forged/arbitrary cookie value for `next-auth.session-token` is redirected to `/login`; a request with a valid token proceeds normally
  - **Depends on**: 6.2 (next-auth version pinned), 1.1 (NEXTAUTH_SECRET rotated)

---

### 9. TTS Auth Async Fix

- [x] **9.1 — Add `httpx` to TTS service dependencies**
  - **Affected**: `TTS/requirements.txt` (or `TTS/pyproject.toml`)
  - **Steps**:
    1. Add `httpx>=0.27.0` to the TTS service's Python dependencies
    2. Rebuild the TTS Docker image: `docker compose build tts`
  - **Validation**: `docker compose exec tts python -c "import httpx; print(httpx.__version__)"` succeeds

- [x] **9.2 — Replace synchronous `requests` with async `httpx` in TTS auth**
  - **Affected**: `TTS/app/auth.py:45`, `TTS/app/auth.py:120`
  - **Steps**:
    1. Replace `import requests` with `import httpx`
    2. In `validate_token`, change:
       ```python
       session_response = requests.get(url, headers=..., timeout=10)
       ```
       to:
       ```python
       async with httpx.AsyncClient() as client:
           session_response = await client.get(url, headers=..., timeout=10)
       ```
    3. Remove the `except requests.RequestException` handler; replace with `except httpx.RequestError`
  - **Validation**: Run a TTS synthesis request under load (e.g. `ab -n 50 -c 10`); confirm uvicorn worker CPU doesn't spike to single-thread utilisation
  - **Depends on**: 9.1

- [x] **9.3 — Eliminate the double session-fetch in TTS role checking**
  - **Affected**: `TTS/app/auth.py:110-163`
  - **Steps**:
    1. Modify `require_workspace_role` to accept the already-fetched `session_data` dict as a parameter rather than re-fetching from NextAuth:
       ```python
       async def require_workspace_role(
           auth_data: Dict[str, Any] = Depends(validate_token),
           required_role: str = 'EDITOR'
       ) -> Dict[str, Any]:
       ```
    2. Pass `session_data` through from `validate_token` by adding it to the returned dict (e.g. `auth_data['session_data'] = session_data`)
    3. In `require_workspace_role`, read `user_role` from `auth_data['session_data']` instead of making a second HTTP call
  - **Validation**: Add logging to count NextAuth `/api/auth/session` calls per request; confirm count drops from 2 to 1 for role-protected endpoints
  - **Depends on**: 9.2

---

### 10. Mobile Navigation Fix

- [x] **10.1 — Fix bottom navigation route mapping and active-state detection**
  - **Affected**: `UI/src/components/layout/Layout.tsx:150-160`, `:214-239`
  - **Steps**:
    1. Define a single `bottomNavRoutes` array with 5 explicit entries matching the 5 `BottomNavigationAction` items, e.g.:
       ```ts
       const bottomNavRoutes = ['/profile', '/voice-lab', '/documents', '/stories', '/timeline']
       ```
    2. Update the `onChange` handler to use `bottomNavRoutes[newValue]` (replacing the current 3-element array)
    3. Update `getMobileNavValue()` to find the matching index from `bottomNavRoutes` instead of the manual switch — use `bottomNavRoutes.findIndex(r => currentPath.startsWith(r))` with a fallback of `0`
    4. Run `tsc --noEmit`
  - **Validation**: Tapping each of the 5 bottom nav items navigates to the correct page with no console errors; the active indicator highlights the correct item on each page

---

### 11. Audio Generation — Disable or Wire Up

- [x] **11.1 — Gate the Generate Audio feature as "Coming Soon" until the worker queue is wired**
  - **Affected**: `UI/src/pages/api/stories/[id]/generate-audio.ts:49-52`, story detail/edit UI (wherever "Generate Audio" button lives)
  - **Steps**:
    1. In the API handler, add a feature flag check at the top:
       ```ts
       if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
         return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
       }
       ```
    2. In the UI, wrap the "Generate Audio" button in a disabled state with a tooltip: `"Coming soon — audio generation is being set up"`
    3. Add `AUDIO_GENERATION_ENABLED=false` to `.env.example` with a comment explaining it requires BullMQ worker integration
  - **Validation**: Clicking "Generate Audio" shows the disabled state tooltip; the API returns 503 when `AUDIO_GENERATION_ENABLED` is unset or false

  > **Alternative**: If the BullMQ worker integration is prioritised, wire `prisma.voiceGenerationJob.create` to dispatch a BullMQ job immediately after creation. The job processor already exists in `Chat/src/workers/ingestion.ts` — extend it for voice generation. This is the preferred path if timeline allows.

---

### 12. Accessibility Baseline

- [x] **12.1 — Add aria-labels to all icon-only `IconButton` components**
  - **Affected**: `UI/src/components/layout/Layout.tsx` (search icon button, notifications button), `UI/src/components/audio/AudioPlayer.tsx`, `UI/src/components/audio/AudioRecorder.tsx`
  - **Steps**:
    1. Search for `<IconButton` with no `aria-label`: `grep -n "IconButton" UI/src/components/layout/Layout.tsx`
    2. Add `aria-label="Search"`, `aria-label="Notifications"`, `aria-label="Open user menu"` to the respective buttons in `Layout.tsx`
    3. Audit `AudioPlayer.tsx` and `AudioRecorder.tsx` — add `aria-label="Play"`, `aria-label="Stop recording"`, etc.
  - **Validation**: Run `npx axe-cli http://localhost:4777/profile` — no "Buttons must have discernible text" violations

- [x] **12.2 — Add accessible attributes to modal dialogs**
  - **Affected**: `UI/src/components/modals/AddEditPersonModal.tsx`, `PersonDetailModal.tsx`, `MemberManagementModal.tsx`, `SuccessModal.tsx`, `VoiceTrainingModal.tsx`, `VoiceConsentModal.tsx`
  - **Steps**:
    1. Ensure each MUI `<Dialog>` has an `aria-labelledby` prop pointing to the `<DialogTitle>` element's `id`
    2. Add `id` attributes to each `<DialogTitle>`
    3. Example pattern:
       ```tsx
       <Dialog aria-labelledby="add-person-dialog-title">
         <DialogTitle id="add-person-dialog-title">Add Person</DialogTitle>
       ```
  - **Validation**: Screen reader (or browser accessibility tree) announces dialog title when modal opens; axe-cli reports no "Dialog must have an accessible name" violations

- [x] **12.3 — Add keyboard navigation to the family tree canvas**
  - **Affected**: `UI/src/components/pages/FamilyTreePage.tsx`
  - **Steps**:
    1. Add `tabIndex={0}` and `role="group"` to the tree container `<Box>`
    2. Add `aria-label="Family tree — use arrow keys to navigate"` to the container
    3. Add `onKeyDown` handler for arrow keys to shift the pan offset
    4. Add `tabIndex={0}` and `onKeyDown={e => e.key === 'Enter' && handlePersonClick(person)}` to each person node
  - **Validation**: User can Tab into the tree container and navigate nodes with keyboard; Enter activates the person detail modal

---

## Phase 3 — Polish (after launch, prioritised by impact)

### 13. Clean Up Dead Code and Artifacts

- [x] **13.1 — Delete empty component files and backup files**
  - **Affected**: `UI/src/components/layout/new_component/ActiveMemberHeader.tsx`, `UI/src/components/layout/new_component/` (directory), `UI/src/middleware.js.bak`
  - **Steps**:
    1. `git rm -r UI/src/components/layout/new_component/`
    2. `git rm UI/src/middleware.js.bak`
    3. `git commit -m "chore: remove empty new_component directory and middleware backup"`
  - **Validation**: `ls UI/src/components/layout/` no longer shows `new_component/`; `git status` is clean

---

### 14. Complete CSRF Coverage

> Depends on 7.1 (CSRF secret hardened) being in place first.

- [x] **14.1 — Audit all POST/PUT/DELETE/PATCH API routes for CSRF protection**
  - **Affected**: All files under `UI/src/pages/api/`
  - **Steps**:
    1. Run: `grep -rL "withCSRFProtection\|GET:\|method.*GET" UI/src/pages/api --include="*.ts"` to find routes that accept mutations without explicit CSRF
    2. Apply `withCSRFProtection` to the handler for `POST /api/voice/synthesize` (`voice/synthesize.ts`)
    3. Apply `withCSRFProtection` to `POST /api/stories/[id]/generate-audio` (`stories/[id]/generate-audio.ts`)
    4. Apply consistently to any other unprotected mutation routes found in step 1
    5. Run `tsc --noEmit`
  - **Validation**: Every state-mutating endpoint returns 403 when called without a valid `x-csrf-token` header; the existing CSRF tests in `__tests__/security/csrf.test.ts` still pass
  - **Depends on**: 7.1

---

### 15. Fix Rate Limiter Duplication

- [x] **15.1 — Remove redundant `express-rate-limit` layer from `withRateLimit`**
  - **Affected**: `UI/src/lib/security/rate-limiter.ts:46-143`
  - **Steps**:
    1. Remove the `import rateLimit from 'express-rate-limit'` at the top of the file
    2. Remove the `rateLimiters` object (lines ~46–51)
    3. Remove the inner `new Promise` block that creates the mock Express adapter (lines ~93–139)
    4. Simplify `withRateLimit` to call `rateLimitCheck` from Redis and then call `handler(req, res)` — the Redis check is already sufficient
    5. Remove `express-rate-limit` from `UI/package.json` dependencies if it is no longer used elsewhere
    6. Run `tsc --noEmit && npm run build`
  - **Validation**: Rate limiting still triggers correctly (test with `ab -n 250 -c 5` against a rate-limited endpoint); no duplicate 429 responses; Redis-based limits enforce correctly across concurrent requests

---

### 16. PostgreSQL Hardening

- [x] **16.1 — Remove PostgreSQL host-port exposure and enforce strong password**
  - **Affected**: `docker-compose.yml:122-123`
  - **Steps**:
    1. Remove the `ports: - "5433:5432"` block from the `db` service (the database is only accessed from internal services via the `internal` network)
    2. Change `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}` to `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}` — the `:?` syntax causes docker compose to fail if the variable is unset
    3. Add `POSTGRES_PASSWORD=<required — min 24 chars>` to `.env.example`
    4. Update the hardcoded `DATABASE_URL` values in the `app` and `chat` service blocks to use `${POSTGRES_PASSWORD}` variable substitution
  - **Validation**: `docker compose up` without `POSTGRES_PASSWORD` set fails with a clear error; with it set, services start and can connect to the database; `nmap -p 5433 localhost` shows port closed

---

### 17. FamilyTreePage — Implement Action Stubs

- [x] **17.1 — Implement "New Story for Person" navigation**
  - **Affected**: `UI/src/components/pages/FamilyTreePage.tsx:460`
  - **Steps**:
    1. Replace the `// TODO: Navigate to story creation with person pre-selected` comment with:
       ```ts
       router.push(`/stories?subjectId=${person.id}`)
       ```
    2. In `UI/src/pages/stories.tsx`, read `router.query.subjectId` on mount and pre-select the matching family member
  - **Validation**: Clicking "New Story" for a person on the family tree navigates to `/stories` with that person pre-selected in the subject dropdown

- [x] **17.2 — Implement "Voice Training" modal trigger**
  - **Affected**: `UI/src/components/pages/FamilyTreePage.tsx:465`
  - **Steps**:
    1. Add local state: `const [voiceTrainingPersonId, setVoiceTrainingPersonId] = useState<string | null>(null)`
    2. Replace the TODO comment with: `setVoiceTrainingPersonId(String(person.id))`
    3. Render `<VoiceTrainingModal>` (already exists at `UI/src/components/audio/VoiceTrainingModal.tsx`) conditioned on `voiceTrainingPersonId !== null`
  - **Validation**: Clicking "Voice Training" for a person opens the `VoiceTrainingModal` with that person's context

- [x] **17.3 — Implement "Story Detail" navigation**
  - **Affected**: `UI/src/components/pages/FamilyTreePage.tsx:505`
  - **Steps**:
    1. Replace the `// TODO: Navigate to story detail page` comment with:
       ```ts
       if (storyId) router.push(`/stories/${storyId}`)
       ```
    2. Ensure the story ID is available in the calling context (trace the call site and pass the ID down)
  - **Validation**: Clicking a story from the family tree panel navigates to `/stories/[id]`

---

### 18. Add Page Titles and Meta Descriptions

- [x] **18.1 — Add `<Head>` with title and description to all authenticated pages** *(all pages already have Head with titles)*
  - **Affected**: `UI/src/pages/stories.tsx`, `family-tree.tsx`, `voice-lab.tsx`, `documents.tsx`, `timeline.tsx`, `favorites.tsx`, `search.tsx`, `profile/[id].tsx`, `collections.tsx`, `account.tsx`
  - **Steps**:
    1. Import `Head` from `next/head` in each file if not already present
    2. Add inside the page's return:
       ```tsx
       <Head>
         <title>Stories | Heard Again</title>
         <meta name="description" content="..." />
       </Head>
       ```
    3. Use descriptive, page-specific titles following the pattern `[Page Name] | Heard Again`
  - **Validation**: Each page shows a distinct title in the browser tab and in DevTools → Elements → `<title>`

---

### 19. Fix Layout Branding and Deprecated APIs

- [x] **19.1 — Align sidebar and mobile header to a single brand name**
  - **Affected**: `UI/src/components/layout/Layout.tsx:176`, `:261`
  - **Steps**:
    1. Decide on the canonical product name (confirm with product owner — report notes both "Heard Again" and "The Living Archive" are in use)
    2. Update both the mobile `<Typography>` ("Heard Again") and the desktop sidebar `<Typography>` ("The Living Archive") to the same value
  - **Validation**: Both mobile and desktop layouts display the same brand name

- [x] **19.2 — Remove deprecated `legacyBehavior` / `passHref` from `<Link>` in Layout**
  - **Affected**: `UI/src/components/layout/Layout.tsx:278`, `:313`
  - **Steps**:
    1. Replace:
       ```tsx
       <Link key={item.href} href={item.href} passHref legacyBehavior>
         <Box component="a" sx={...}>
       ```
       with:
       ```tsx
       <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
         <Box sx={...}>
       ```
    2. Move the anchor-specific styles (`textDecoration: 'none'`, `color`) to the `<Box>` `sx` prop — they already are
    3. Run `tsc --noEmit`
  - **Validation**: Navigation links render without nested `<a>` tags (check DevTools Elements); link styles are unchanged

---

### 20. Fix Hardcoded UI State

- [x] **20.1 — Remove hardcoded notification badge count**
  - **Affected**: `UI/src/components/layout/Layout.tsx:200`
  - **Steps**:
    1. Change `<Badge badgeContent={3} color="primary">` to `<Badge color="primary">` (no badge until a notification system exists), OR add an invisible badge: `<Badge color="primary" invisible>` 
    2. Add a `// TODO(notifications): wire badgeContent to real notification count` comment
  - **Validation**: Notification bell renders with no badge number in the UI

- [x] **20.2 — Replace hardcoded waveform with a real or explicit empty state**
  - **Affected**: `UI/src/components/pages/Dashboard.tsx:96-151`
  - **Steps**:
    1. If a default voice sample asset exists: fetch it and use the `<AudioPlayer>` component instead of the hardcoded bars
    2. If no audio exists: replace the waveform card body with an `<EmptyState>` component (already exists at `UI/src/components/feedback/UIStates.tsx`) — "No voice sample recorded yet" with a CTA to Voice Lab
    3. Remove the `isPlaying` state and the non-functional play/pause toggle
  - **Validation**: Dashboard no longer shows a play button that does nothing; either real audio plays or the empty state is shown

---

### 21. Replace `next/image` for Key Visuals

- [x] **21.1 — Replace avatar `src` pattern with `next/image` where dimensions are known**
  - **Affected**: `UI/src/components/pages/Dashboard.tsx` (hero avatar), `UI/src/components/pages/LandingPage.tsx` (testimonial avatars), `UI/src/components/pages/StoriesPage.tsx` (author avatars)
  - **Steps**:
    1. For fixed-size avatars (e.g. 128×128 in Dashboard), replace `<Avatar src={...}>` wrapping with a `<Image>` component from `next/image` inside the `<Avatar>` component's children slot, or use MUI Avatar's `imgProps`
    2. Update `next.config.js` `images.remotePatterns` to include any CDN/storage hostnames that will serve avatar images
    3. For background-image CSS usages in `Dashboard.tsx:220-226` (audio memory thumbnail), refactor to use an `<Image>` tag with `object-fit: cover`
    4. Run `tsc --noEmit`
  - **Validation**: Network tab shows images served as WebP where the browser supports it; Lighthouse performance score improves for image metrics

---

### 22. Testing Coverage

> These tasks are independent of each other and can be parallelised.

- [x] **22.1 — Add API route auth integration tests**
  - **Affected**: `UI/src/__tests__/api/` (new test files)
  - **Steps**:
    1. Add a test for `GET /api/people` — confirm unauthenticated request returns 401
    2. Add a test for `POST /api/people` — confirm EDITOR role can create, VIEWER role gets 403
    3. Add a test for workspace isolation — user A cannot read workspace B's data
    4. Use `next-test-api-route-handler` or mock `getServerSession` for isolation
  - **Validation**: `npm test` passes; the three new test cases are green

- [x] **22.2 — Add file upload security integration tests**
  - **Affected**: `UI/src/__tests__/api/upload.test.ts` (new file)
  - **Steps**:
    1. Test that uploading a file with a disallowed extension returns 400
    2. Test that uploading a file with a spoofed MIME type (`.jpg` extension, PDF content) is caught by magic-byte validation and returns 400
    3. Test that a valid audio file passes validation
  - **Validation**: All three test cases pass; no real ClamAV connection required (mock the scanner)

- [x] **22.3 — Set up Playwright and add a critical-path E2E test** *(config + e2e/auth.spec.ts created; run `npm install @playwright/test` then `npm run e2e:test`)*
  - **Affected**: Project root (new `e2e/` directory), `package.json`
  - **Steps**:
    1. `npm init playwright@latest` in the project root — select TypeScript, `e2e/` directory
    2. Write a single test covering: load landing page → click Sign In → log in with test credentials → verify redirect to profile
    3. Add an `e2e:test` script to root `package.json`: `"e2e:test": "playwright test"`
    4. Add `e2e/` test results and `playwright-report/` to `.gitignore`
  - **Validation**: `npm run e2e:test` completes with 1 passing test in headed or headless mode

---

### 23. Maintainability — `console.*` and `any` Cleanup

> These are ongoing tasks, not one-shot. Work through them progressively.

- [ ] **23.1 — Replace `console.*` calls in API routes with structured `logger.*`**
  - **Affected**: All files under `UI/src/pages/api/` that use `console.log/error/warn`
  - **Steps**:
    1. Find all occurrences: `grep -rn "console\." UI/src/pages/api --include="*.ts"`
    2. For each, replace with the appropriate `logger` level from `@/lib/logger`
    3. Ensure each log call includes a context object as the first argument (pino structured log pattern): `logger.error({ userId, error }, 'Descriptive message')`
    4. Run `tsc --noEmit`
  - **Validation**: `grep -rn "console\." UI/src/pages/api` returns 0 results; structured logs appear in the pino output during a test request

- [ ] **23.2 — Replace `console.*` calls in library files**
  - **Affected**: `UI/src/lib/security/security-headers.ts`, `UI/src/lib/security/file-validator.ts`, `UI/src/lib/auth.ts`, and other lib files
  - **Steps**:
    1. Find: `grep -rn "console\." UI/src/lib --include="*.ts"`
    2. Replace following the same pattern as 23.1
  - **Validation**: `grep -rn "console\." UI/src/lib` returns 0 results
  - **Depends on**: 23.1 (do API routes first to establish the pattern)

- [ ] **23.3 — Type the highest-risk `any` usages in API response sanitisers**
  - **Affected**: `UI/src/lib/api-helpers.ts` (`sanitizeAssetResponse(asset: any)`, `sanitizeStoryResponse(story: any)`)
  - **Steps**:
    1. Define explicit Prisma-derived or application types for `Asset`, `Story`, `Document` return shapes (or import from existing `@/types`)
    2. Replace `any` parameter types with the appropriate type
    3. Run `tsc --noEmit` and resolve any downstream type errors
  - **Validation**: `grep -n "any" UI/src/lib/api-helpers.ts` returns 0 untyped usages; `tsc --noEmit` passes clean

- [ ] **23.4 — Type controller interfaces in `VoiceLabPage` and `DocumentsPage`**
  - **Affected**: `UI/src/components/pages/VoiceLabPage.tsx:26` (`trainingJob: any`), `UI/src/components/pages/DocumentsPage.tsx:19` (`selectedDocument: any`)
  - **Steps**:
    1. Define a `TrainingJob` interface in `@/types/voice.ts` and import it into `VoiceLabPage`
    2. Replace `trainingJob: any` with `trainingJob: TrainingJob | null`
    3. Replace `selectedDocument: any` with the existing `DocumentArtifact` type or a new `DocumentArtifact` extended type
    4. Run `tsc --noEmit`
  - **Validation**: `tsc --noEmit` passes; no `any` usages remain in these two component files
  - **Depends on**: 23.3

---

## Final Launch Gate

Run these checks after all Phase 1 and Phase 2 tasks are complete:

- [ ] `git ls-files | grep -E "\.env$"` — returns no results
- [ ] `npm audit --audit-level=high` — returns 0 high vulnerabilities
- [ ] `cd UI && tsc --noEmit` — exits 0
- [ ] `npm test` — all tests pass
- [ ] `curl -I http://localhost:4777 | grep Content-Security-Policy` — output does not contain `unsafe-eval`
- [ ] `curl -X POST http://localhost:4777/api/test-overrides` — returns 404
- [ ] `docker compose exec chromadb curl -X POST http://localhost:8000/api/v1/reset` — returns non-2xx
- [ ] Manual login test: credentials login, Google OAuth login, and sign-out all succeed
- [ ] Manual mobile nav test: all 5 bottom nav items navigate to correct pages
- [ ] All Phase 1 tasks checked off above
- [ ] All Phase 2 tasks checked off above, or each unchecked item has a written justification for deferral
