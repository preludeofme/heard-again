# Follow-up Tasks

## Storage

- [ ] **`s3-provider.ts:19` — unused `region` field** (`TS6133`): `this.region` is assigned in the constructor but never read. Either remove it or wire it into URL construction if needed for non-R2 S3 fallback.

- [ ] **Stale `publicUrl` in database**: `getPublicUrl()` now returns a presigned URL (1hr expiry). Any API route that reads `publicUrl` directly from the DB and returns it to the client will serve expired URLs. Audit routes in `UI/src/pages/api/` that return file URLs and replace DB-read `publicUrl` with a fresh `getPublicUrl(storagePath)` call at serve time.

## Environment

- [ ] **`STRIPE_WEBHOOK_SECRET` is empty**: Set after adding the webhook endpoint in Stripe Dashboard → Developers → Webhooks → `https://your-domain.com/api/webhooks/stripe`.
