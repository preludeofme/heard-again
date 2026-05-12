# Follow-up Tasks

## Storage

- [ ] **`s3-provider.ts:19` — unused `region` field** (`TS6133`): `this.region` is assigned in the constructor but never read. Either remove it or wire it into URL construction if needed for non-R2 S3 fallback.

- [ ] **Stale `publicUrl` in database**: `getPublicUrl()` now returns a presigned URL (1hr expiry). Any API route that reads `publicUrl` directly from the DB and returns it to the client will serve expired URLs. Audit routes in `UI/src/pages/api/` that return file URLs and replace DB-read `publicUrl` with a fresh `getPublicUrl(storagePath)` call at serve time.

## Vercel Filesystem (read-only outside /tmp)

These routes write to `process.cwd()` which is read-only on Vercel. They will fail when hit in production:

- [ ] `UI/src/pages/api/import/gedcom.ts:64,119` — reads/writes paths relative to `process.cwd()`; switch temp writes to `os.tmpdir()` and storage writes to R2
- [ ] `UI/src/pages/api/import/gedcom-preview.ts:78` — same issue
- [ ] `UI/src/pages/api/import/json.ts:110` — same issue
- [ ] `UI/src/pages/api/import/bulk-audio.ts:129` — same issue
- [ ] `UI/src/pages/api/assets/[id]/download.ts:12` — `STORAGE_ROOT` based on `process.cwd()`; only hits this path when `STORAGE_MODE=local`, safe to ignore while using R2, but should be removed to avoid confusion

## Environment

- [ ] **`STRIPE_WEBHOOK_SECRET` is empty**: Set after adding the webhook endpoint in Stripe Dashboard → Developers → Webhooks → `https://your-domain.com/api/webhooks/stripe`.
