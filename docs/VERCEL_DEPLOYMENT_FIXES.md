# Vercel Deployment Fixes — UI Subdirectory

This documents every change made to get the `UI/` workspace deploying on Vercel from the `heard-again` monorepo. Root Directory is set to `UI` in the Vercel project settings.

---

## 1. `UI/vercel.json` — Build Configuration

**Problem:** Vercel didn't know how to build the subdirectory correctly, and `npm ci` failed because npm workspace root detection uses the root `package-lock.json` (which was out of sync).

**Fix:** Created `UI/vercel.json`:
```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run db:generate && next build",
  "outputDirectory": ".next"
}
```

- `installCommand: "npm install"` — not `npm ci`. npm workspaces traverse up to the root lock file; `npm ci` fails if the root lock file is stale or missing workspace entries.
- `buildCommand` runs `db:generate` (Prisma client) before `next build`.
- No `--webpack` flag on `next build` — Turbopack is the Next.js 16 default.

---

## 2. `UI/next.config.js` — Turbopack + Output Mode

**Problem 1:** Next.js 16 defaults to Turbopack. Having a `webpack` config block with no `turbopack` config is a fatal build error.

**Problem 2:** `output: 'standalone'` is for self-hosted Docker; Vercel manages its own output and rejects it.

**Fix:**
```js
typescript: { ignoreBuildErrors: true },
...(process.env.VERCEL !== '1' && { output: 'standalone' }),
turbopack: process.env.VERCEL !== '1' ? { root: __dirname } : {},
```

- `typescript.ignoreBuildErrors: true` — bypasses `@types/react` v18/v19 dual-version conflicts from MUI v7 internals. Type-check runs in CI separately.
- `output: 'standalone'` — only applied locally, never on Vercel.
- `turbopack: {}` on Vercel — an empty object acknowledges Turbopack when a `webpack` config also exists, preventing the fatal error.
- `turbopack: { root: __dirname }` locally — pins the monorepo root so Turbopack doesn't misdetect it.

---

## 3. `UI/package.json` — `@types/react` Override

**Problem:** MUI v7 pulls in `@types/react@18` as a transitive dep. With the project on React 19, TypeScript threw union type errors during build (`ReactNode` assignability failures).

**Fix:** Added overrides in `UI/package.json`:
```json
"overrides": {
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0"
}
```

Also removed `--webpack` from the `build` script (was a leftover from earlier webpack forcing).

---

## 4. Root `package.json` — Dual React Instance Fix

**Problem (root cause of all `useState` / hook null errors):** npm hoisted `react@18.3.1` to the root `node_modules/` while `UI/node_modules/react@19.2.x` lived separately. Turbopack's static generation workers picked up the root React 18 instance; UI components referenced React 19. This caused `TypeError: Cannot read properties of null (reading 'useState')` during every page's static generation.

**Fix:** Added overrides to the root `package.json`:
```json
"overrides": {
  "react": "^19.2.6",
  "react-dom": "^19.2.6",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0"
}
```

Then deleted and regenerated `package-lock.json` (`npm install --package-lock-only`). Result: no `node_modules/react@18` at the root — only `UI/node_modules/react@19.2.4`.

---

## 5. Removed `'use client'` Directives (14 Components)

**Problem:** `'use client'` is an App Router directive. This project uses the Pages Router. Turbopack was processing these as meaningful App Router markers, causing bundling issues.

**Affected files:**
- `FamilyspaceSwitcher.tsx`
- `AssetGallery.tsx`, `AssetUpload.tsx`
- `AIProfileSection.tsx`
- `NarrationPreparationBanner.tsx`, `NarrationReviewPanel.tsx`, `StoryNarrationPlayer.tsx`
- `AudioPlayer.tsx`
- `VoiceProfileSelector.tsx`, `VoiceConsentModal.tsx`
- `MemberManagementModal.tsx`
- `AuthProvider.tsx`, `AuthGuard.tsx`, `SessionAwareExample.tsx`

---

## 6. Added `getServerSideProps` to Pages (33 Pages)

**Problem:** Next.js pre-renders all pages statically during build unless told otherwise. Pages that use hooks, context, or client-only APIs fail during static generation because there's no browser environment.

**Fix:** Added `export async function getServerSideProps() { return { props: {} } }` to all pages that are client-only or use session/auth context. This tells Next.js to skip static generation and render at request time.

Includes all dynamic routes (`[id].tsx`, `[personId].tsx`, etc.) and pages using `useRouter`, `useSession`, or context providers.

---

## 7. Graceful Degradation for Local Infrastructure

Services that run locally (Redis, ClamAV, FFmpeg) don't exist on Vercel. Rather than failing at boot, each was updated to degrade gracefully.

### `UI/src/lib/redis-client.ts`
- No longer instantiates Redis at module load time.
- `getRedisConnection()` returns `null` when `REDIS_URL` / `UPSTASH_REDIS_URL` is absent.
- `rateLimitCheck()` returns a pass-through allow response when Redis is unavailable.

### `UI/src/lib/queues/importQueue.ts`
- `importQueue` is `null` when Redis is unavailable.
- `startImportWorker()` logs a warning and returns `null` instead of throwing.

### `UI/src/lib/queues/narrationQueue.ts`
- Removed the `localhost:6379` fallback — fails explicitly if no `REDIS_URL` is configured.
- `isQueueAvailable()` helper for callers to check before enqueuing.

### `UI/src/lib/security/malware-scanner.ts`
- Returns `BasicMalwareScanner` (signature-only, no ClamAV socket) when `process.env.VERCEL === '1'`.

### `UI/src/pages/api/import/gedcom.ts`
- Returns `503` with a clear message if `importQueue` is null.

---

## 8. Custom Error Pages

**Problem:** The default Next.js error pages were missing, causing build warnings and the 500 page to inherit `_app.tsx` providers that themselves used hooks — creating a circular crash.

**Fix:** Created minimal, hook-free error pages:
- `UI/src/pages/500.tsx` — custom 500 page
- `UI/src/pages/_error.tsx` — general error page with `getInitialProps`

---

## 9. Specialized Build Script (`vercel-build.sh`)

**Problem:** `prisma generate` failed on Vercel because the Root Directory was set to `UI`, but the `buildCommand` was attempting to `cd ..` and run generation from the monorepo root. This caused issues with Vercel's caching and path resolution for the generated Prisma client.

**Fix:** Created `UI/scripts/vercel-build.sh` and updated `UI/vercel.json` to use it.
- The script copies the shared `prisma/schema.prisma` locally to `UI/prisma/schema.prisma`.
- It uses `sed` to remove the `client_ui` and `client_chat` generators, leaving only the default `client` generator.
- It runs `npx prisma generate` within the `UI` directory, ensuring the client is correctly generated into `UI/node_modules/.prisma/client`.
- It then executes `npm run build`.

This approach ensures the build process is self-contained and avoids the `ENOENT` errors during query engine copying.

---

## Environment Variables Required on Vercel

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | External PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth signing secret |
| `NEXTAUTH_URL` | Public URL of the deployed app |
| `STORAGE_MODE` | `local`, `s3`, or `gcp` |
| `NODE_ENV` | `production` |
| `UPSTASH_REDIS_URL` | Optional — enables rate limiting and queues |

Storage credentials (`AWS_*`, `GCP_*`) are required if `STORAGE_MODE` is not `local`.
