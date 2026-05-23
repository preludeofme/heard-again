# QA Blocker Resolution Guide

## Overview

This document provides step-by-step instructions for resolving all issues identified during end-to-end QA testing of Heard Again (heardagain.com). Each blocker includes the root cause, exact files to modify, and verification steps.

**Date:** May 23, 2026
**Stack:** Next.js 14, MUI, Prisma, Next-Auth, Vercel

---

## Table of Contents

1. [CRITICAL: People API 500 Error Blocking All Node Interactivity](#1-critical-people-api-500-error-blocking-all-node-interactivity)
2. [HIGH: MUI Dialog Backdrop Blocks Toolbar Buttons](#2-high-mui-dialog-backdrop-blocks-toolbar-buttons)
3. [HIGH: PWA Icons Blocked by Auth Middleware](#3-high-pwa-icons-blocked-by-auth-middleware)
4. [MEDIUM: Reset Password Page Shows Blank Spinner Without Token](#4-medium-reset-password-page-shows-blank-spinner-without-token)
5. [MEDIUM: `/terms-legacy` Route Redirects to Login Instead of Content](#5-medium-terms-legacy-route-redirects-to-login-instead-of-content)
6. [MEDIUM: Billing `/api/billing/usage` Returns 404](#6-medium-billing-apibillingusage-returns-404)
7. [LOW: Copyright Year Shows 2024 Instead of 2026](#7-low-copyright-year-shows-2024-instead-of-2026)

---

## 1. CRITICAL: People API 500 Error Blocking All Node Interactivity

### Impact

Every interactive action on family tree nodes (STORY, EDIT, FOCUS, KIN, ADD buttons) calls `/api/people/{personId}` and receives a 500 error. This makes the entire family tree non-interactive. Users cannot view person details, add relatives, edit profiles, or create stories from the tree.

### Root Cause

The `PersonService.getPersonDetail()` method (line 171) calls `this.repo.findById(personId, familyspaceId, include)` with nested Prisma includes. The include object references relations that either:

1. **Don't exist in the Prisma schema** — e.g., `avatarAsset`, `voiceProfiles`, `storiesAsSubject`, `storiesAsSpeaker` are queried but may not be defined as Prisma relations on the `Person` model.
2. **Have type mismatches** — the `familyUnit` query on line 203 accesses `(this.repo as any).prisma.familyUnit` which bypasses the type-safe repository pattern and could fail if the model is named differently (e.g., `familyUnit` vs `familyunit`).

### Fix Steps

**Step 1: Verify Person Prisma relations exist**

Open `UI/prisma/schema.prisma` and confirm the `Person` model includes these relations:

```prisma
model Person {
  // ... existing fields ...

  avatarAsset     Asset?          @relation(fields: [avatarAssetId], references: [id])
  avatarAssetId   String?
  voiceProfiles   VoiceProfile[]
  storiesAsSubject Story[]         @relation("SubjectStories")
  storiesAsSpeaker Story[]         @relation("SpeakerStories")
}
```

If any are missing, add them and run `npx prisma generate`.

**Step 2: Fix the familyUnit query**

In `UI/src/services/PersonService.ts`, replace the `(this.repo as any).prisma.familyUnit.findMany(...)` call with the proper repository wrapper. First, add a method to `PersonRepository`:

In `UI/src/server/repositories/PersonRepository.ts`:

```typescript
async findFamilyUnits(personId: string, familyspaceId?: string) {
  return this.prisma.familyUnit.findMany({
    where: {
      familyspaceId,
      OR: [
        { parents: { some: { parentId: personId } } },
        { children: { some: { childId: personId } } },
      ],
    },
    include: {
      parents: {
        include: {
          parent: {
            select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      children: {
        include: {
          child: {
            select: { id: true, firstName: true, lastName: true, avatarAssetId: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}
```

Then update `getPersonDetail` in `PersonService.ts`:

```typescript
const familyUnits = await this.repo.findFamilyUnits(personId, familyspaceId)
```

Remove the `(this.repo as any).prisma.familyUnit.findMany` line.

**Step 3: Wrap with try/catch and log the error**

Add error logging to `getPersonDetail` so future 500s are debuggable:

```typescript
try {
  const person = await this.repo.findById(personId, familyspaceId, { ... })
  // ... rest of logic
} catch (error) {
  console.error(`[PersonService] getPersonDetail failed for personId=${personId}:`, error)
  throw error  // re-throw so the API returns 500 with the actual error message
}
```

Also update the API route at `UI/src/pages/api/people/[id].ts` to catch and return the actual error message instead of a generic 500:

```typescript
try {
  const result = await personService.getPersonDetail(personId, familyspaceId)
  // ...
} catch (error) {
  return res.status(500).json({
    error: error instanceof Error ? error.message : 'Failed to get person details',
  })
}
```

### Verification

```
curl -s https://www.heardagain.com/api/people/{test-person-id} -H "Cookie: <session-cookie>" | jq .
```

Should return a valid person detail object, not a 500.

---

## 2. HIGH: MUI Dialog Backdrop Blocks Toolbar Buttons

### Impact

The `<PersonModal>` component (rendered as an MUI `<Dialog>`) is rendered at the page level in `family-tree.tsx` (line 644). When this dialog is closed, the MUI Dialog component's CSS transition may leave a transparent but click-blocking backdrop overlay. This prevents users from clicking toolbar buttons (S, R, Import, Export, PNG, SVG, PDF, filter) and the profile "S" button.

### Root Cause

The `PersonModal` is rendered **outside** the tree component in the page layout. When the dialog is opened and closed via the `open` prop, MUI's `Dialog` may keep its `role="presentation"` backdrop in the DOM during exit transitions. If the `onClose` handler doesn't fully flush the dialog's internal state, the backdrop remains as a transparent overlay with `pointer-events: auto`.

### Fix Steps

**Step 1: Force unmount on close**

In `UI/src/pages/family-tree.tsx`, modify the `PersonModal` to use `keepMounted={false}` (this is the default but verify):

```tsx
<PersonModal
  open={isPersonModalOpen}
  personId={selectedPersonId}
  initialTab={personModalInitialTab}
  onClose={() => {
    setIsPersonModalOpen(false)
    setSelectedPersonId(null)
    fetchPeople()
  }}
  onPersonClick={(id) => {
    setSelectedPersonId(id)
  }}
  onSave={() => fetchPeople()}
  onDelete={() => fetchPeople()}
  onViewFullProfile={(id) => {
    router.push(`/profile/${id}`)
  }}
/>
```

If the `PersonModal` internally wraps an MUI `<Dialog>`, add `keepMounted={false}` to that `<Dialog>` inside `PersonDetailModal.tsx`.

**Step 2: Add a close delay to flush transitions**

If the backdrop persists, add a small timeout in `onClose`:

```typescript
onClose={() => {
  setIsPersonModalOpen(false)
  // Small delay to ensure dialog exit transition completes
  setTimeout(() => {
    setSelectedPersonId(null)
  }, 300)
}}
```

**Step 3: Ensure Dialog `slotProps.backdrop` has proper behavior**

In `PersonDetailModal.tsx`, set the backdrop to not capture clicks after close:

```tsx
<Dialog
  open={open}
  onClose={handleClose}
  slotProps={{
    backdrop: {
      sx: {
        // Ensure backdrop doesn't linger
        '&.MuiBackdrop-invisible': { pointerEvents: 'none' },
      },
    },
  }}
>
```

### Verification

1. Open a family tree node detail modal
2. Close it
3. Click any toolbar button (S, R, Import, Export, PNG, etc.) — it should trigger

---

## 3. HIGH: PWA Icons Blocked by Auth Middleware

### Impact

PWA icons (`/icon-192.png`, `/icon-512.png`) return the login page HTML instead of the actual image files. This breaks the PWA manifest, causing browsers to show no icon when adding to home screen and preventing install prompts.

### Root Cause

There is no `middleware.ts` file in the `UI/src/` directory path, which means the auth protection is likely configured via `next-auth`'s `unstable_getServerSession` in the `_app.tsx` or via a catch-all `getServerSideProps`. However, static files under `/public/` (like manifest.json, icons, favicon) should be served by Next.js before any page-level auth. The manifest.json references `/icon-192.png` and `/icon-512.png` but these paths may be caught by a catch-all page handler or page-level redirect.

Inspect `manifest.json` — if it references root-relative paths (`/icon-192.png`), and these files exist in `UI/public/`, they should be served automatically. If they're returning auth redirects, something is intercepting static file serving.

### Fix Steps

**Step 1: Check `manifest.json` references**

Read `UI/public/manifest.json` and verify the icon paths:

```json
{
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Verify icons exist in `public/`**

```bash
ls -la UI/public/icon-192.png UI/public/icon-512.png UI/public/favicon.ico
```

If missing, generate standard PWA icons (192x192 and 512x512 PNGs) and place them in `UI/public/`.

**Step 3: Add middleware.ts to bypass auth for static assets**

Create `UI/src/middleware.ts`:

```typescript
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      // Allow static assets through without auth
      const { pathname } = req.nextUrl
      if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/') ||
        pathname === '/icon-192.png' ||
        pathname === '/icon-512.png' ||
        pathname === '/favicon.ico' ||
        pathname === '/manifest.json' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/privacy') ||
        pathname.startsWith('/terms')
      ) {
        return true
      }
      return !!token
    },
  },
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Alternatively**, if no middleware exists and auth is handled in a custom `_app.tsx` or per-page `getServerSideProps`, file a bug report with next-auth — static files in `/public/` should never be intercepted. The fix may involve upgrading next-auth or checking if `middleware.ts` was accidentally deleted from the deploy.

### Verification

```
curl -s -o /dev/null -w "%{http_code}" https://www.heardagain.com/icon-192.png
# Expected: 200 (image/png)
# Current: 200 (but returns HTML login page content)
```

---

## 4. MEDIUM: Reset Password Page Shows Blank Spinner Without Token

### Impact

Navigating to `/reset-password` without a `?token=` query parameter shows a permanent `CircularProgress` spinner with no error message or fallback UI. This is a poor user experience — users who navigate directly or follow a stale link see an infinite loading state.

### Root Cause

In `UI/src/pages/reset-password.tsx`, line 38-64, the `useEffect` hook checks `if (!token) return` — when `token` is undefined (no query param), the hook exits early without setting `isVerifying` to `false`. The component stays in the loading state indefinitely.

Additionally, during SSR, `router.query` is empty so `token` is always `undefined` on first render. The spinner renders before the client-side hydration can populate it.

### Fix Steps

**Step 1: Handle missing token gracefully**

In `UI/src/pages/reset-password.tsx`, update the `useEffect`:

```typescript
useEffect(() => {
  if (!token) {
    setError('No reset token provided. Please use the link from your password reset email.')
    setIsVerifying(false)
    return
  }

  const verifyToken = async () => {
    try {
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid or expired token')
      }

      setEmail(data.email)
      setIsVerifying(false)
    } catch (err: any) {
      setError(err.message || 'This password reset link is invalid or has expired.')
      setIsVerifying(false)
    }
  }

  verifyToken()
}, [token])
```

This way, when `token` is missing, the page immediately shows the error UI (the "Link Expired" state with "Request New Reset Link" button) instead of an infinite spinner.

**Step 2: Prevent flash of spinner during SSR**

Add a loading state check before the main render:

```typescript
if (isVerifying) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  )
}
```

Also consider adding a timeout:

```typescript
useEffect(() => {
  // Safety timeout — if verification takes more than 10s, show error
  const timeout = setTimeout(() => {
    if (isVerifying) {
      setIsVerifying(false)
      setError('Verification timed out. Please try again.')
    }
  }, 10000)

  // ... existing verification logic ...

  return () => clearTimeout(timeout)
}, [token])
```

### Verification

```
curl -s https://www.heardagain.com/reset-password | grep -i "expired\|reset token"
```

Should show the error UI instead of a blank spinner.

---

## 5. MEDIUM: `/terms-legacy` Route Redirects to Login Instead of Content

### Impact

The `/terms-legacy` route (referenced in footer as "Terms of Legacy") returns the login page instead of actual legal content. Users cannot view legacy terms of service.

### Root Cause

There is no `terms-legacy.tsx` page file in `UI/src/pages/`. The link in the footer goes to `/terms-legacy` which is an unknown route. Since the app uses per-page auth checks in `_app.tsx` or `getServerSideProps`, unknown routes may be caught by a catch-all handler that redirects to login.

Alternatively, the footer link should point to `/terms` (which exists) but currently points to `/terms-legacy`.

In `reset-password.tsx` line 416-425, the footer link is:

```tsx
<Link href="/terms" style={{ textDecoration: 'none' }}>
  Terms of Legacy
</Link>
```

But in other page footers (check `LoginPage.tsx`, `CreateAccountPage.tsx`, etc.), the link may point to `/terms-legacy`.

### Fix Steps

**Step 1: Create the legacy terms page**

Create `UI/src/pages/terms-legacy.tsx`:

```tsx
import React from 'react'
import { Box, Typography, Container } from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import Link from 'next/link'

export default function TermsLegacyPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h3" sx={{ mb: 4, fontFamily: 'var(--font-newsreader), serif' }}>
          Terms of Legacy
        </Typography>
        {/* Add legacy terms content here */}
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          [Legacy terms of service content goes here]
        </Typography>
        <Link href="/terms" style={{ color: 'primary.main' }}>
          View Current Terms of Service
        </Link>
      </Container>
    </Box>
  )
}

export async function getServerSideProps() { return { props: {} } }
```

**Step 2: Or fix the footer link to point to `/terms`**

If legacy terms aren't needed, find all footer components and update the link:

Search for files referencing `terms-legacy`:

```bash
grep -r "terms-legacy" UI/src/
```

Replace with `/terms` in each footer.

**Step 3: Whitelist the route in auth middleware**

Add `/terms-legacy` to the public routes in the middleware config (see Fix Step 3 above).

### Verification

```
curl -s -o /dev/null -w "%{http_code}" https://www.heardagain.com/terms-legacy
# Expected: 200 with actual content, not login redirect
```

---

## 6. MEDIUM: Billing `/api/billing/usage` Returns 404

### Impact

The `/api/billing/usage` endpoint returns a 404, which breaks the subscription page and dashboard. Users cannot view their current billing period usage stats (storage, voice generation minutes, member counts).

### Root Cause

The endpoint file exists at `UI/src/pages/api/billing/usage.ts` but the export structure may not match Next.js expectations. The `apiHandler` wrapper or an import issue could cause the route to be unresolved at runtime.

Looking at the code, the file correctly exports a default handler via `apiHandler`. The 404 may be caused by:

1. **Vercel deployment issue** — the file wasn't deployed or the build cache is stale
2. **Import resolution failure** — one of the imports (`@/lib/prisma`, `@/lib/api-helpers`, `@/lib/auth-helpers`) fails at runtime, causing the module to throw before registering the route
3. **`apiHandler` not properly routing the GET method**

### Fix Steps

**Step 1: Check Vercel deployment**

```bash
# Verify the file exists in the deployment
npx vercel list
npx vercel inspect --scope <project>
```

**Step 2: Add a direct export fallback**

In `UI/src/pages/api/billing/usage.ts`, add a raw handler as a fallback:

```typescript
// Add at the bottom — in case apiHandler doesn't register properly
export async function GET(req: NextApiRequest, res: NextApiResponse) {
  // ... same logic ...
}
```

**Step 3: Add a health check log**

Add a console log at the top of the handler to verify the module is loaded:

```typescript
console.log('[billing/usage] Module loaded, registering GET handler')
```

Then check Vercel function logs after deploying.

**Step 4: Test locally first**

```bash
cd UI
npm run dev
curl http://localhost:3000/api/billing/usage -H "Cookie: <dev-session>"
```

If it works locally but not on Vercel, the issue is deployment-related (build cache, environment variables, or missing `formatBytes` import).

**Step 5: Move `formatBytes` out of the handler**

The `formatBytes` function is defined at module scope (line 102). If there's an import issue above it, the function never registers. Move `formatBytes` to a shared utility:

```typescript
// In UI/src/lib/format.ts
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
```

Then import it in the handler.

### Verification

```
curl -s https://www.heardagain.com/api/billing/usage -H "Cookie: <session-cookie>" | jq .
# Expected: 200 with usage stats JSON
# Current: 404
```

---

## 7. LOW: Copyright Year Shows 2024 Instead of 2026

### Impact

Footer copyright in multiple public pages shows "© 2024 Heard Again" instead of "© 2026". Minor branding issue that affects professional appearance.

### Root Cause

The copyright string is hardcoded in at least 15 footer components across the app. Each footer independently renders the year as a static string.

### Fix Steps

**Step 1: Create a shared copyright component**

Create `UI/src/components/layout/CopyrightFooter.tsx`:

```tsx
import React from 'react'
import { Typography, Box } from '@mui/material'

interface CopyrightFooterProps {
  variant?: 'caption' | 'body2'
  color?: string
}

export default function CopyrightFooter({ variant = 'caption', color = 'secondary.main' }: CopyrightFooterProps) {
  return (
    <Typography variant={variant} sx={{ color }}>
      &copy; {new Date().getFullYear()} Heard Again. A sanctuary for identity.
    </Typography>
  )
}
```

Using `new Date().getFullYear()` ensures the year automatically updates.

**Step 2: Replace hardcoded strings**

Find all occurrences:

```bash
grep -rn "2024 Heard Again" UI/src/
```

Replace each with `<CopyrightFooter />` (or a simpler inline if a component import is too invasive).

For quick inline fix without a new component, replace each occurrence of `© 2024` with `© 2026`:

```bash
grep -rl "2024 Heard Again" UI/src/ | xargs sed -i 's/© 2024 Heard Again/© 2026 Heard Again/g'
```

Or use the dynamic approach:

```bash
grep -rl "2024 Heard Again" UI/src/ | while read f; do
  sed -i 's|© 2024 Heard Again|© {new Date().getFullYear()} Heard Again|g' "$f"
done
```

### Verification

```
curl -s https://www.heardagain.com/ | grep -o "202[0-9] Heard Again"
# Expected: "2026 Heard Again"
# Current: "2024 Heard Again"
```

---

## Summary by Priority

| Priority | Issue | File(s) | Estimated Effort |
|----------|-------|---------|-----------------|
| CRITICAL | People API 500 | `PersonService.ts`, `PersonRepository.ts`, `schema.prisma`, `api/people/[id].ts` | 2-4 hours |
| HIGH | Dialog backdrop blocks buttons | `family-tree.tsx`, `PersonDetailModal.tsx` | 1-2 hours |
| HIGH | PWA icons blocked | `middleware.ts` (create), `public/` icons | 1-2 hours |
| MEDIUM | Reset password spinner | `reset-password.tsx` | 30 min |
| MEDIUM | /terms-legacy redirect | Create `terms-legacy.tsx` or fix footer link | 30 min |
| MEDIUM | Billing API 404 | `api/billing/usage.ts`, Vercel deploy check | 1-2 hours |
| LOW | Copyright year | 15+ footer files across the app | 30 min |

**Total estimated effort:** 7-12 hours

---

## Quick Wins (can be done in parallel)

1. **Copyright year** — simple `sed` replacement across all files
2. **Reset password spinner** — small `useEffect` fix in one file
3. **`/terms-legacy`** — either create the page or fix the footer link
4. **Dialog backdrop** — add `keepMounted={false}` and backdrop slot props
