# Migration Guide: GCP to Managed Provider Stack

## What this repo now supports
- CI/CD is GitHub Actions + Vercel Git Integration (no Cloud Build dependency for app deployments).
- Storage defaults to Cloudflare R2 mode (`STORAGE_MODE=r2`) when set via env.
- Redis/BullMQ now supports URL-based TLS Redis (`UPSTASH_REDIS_URL` / `REDIS_URL` with `rediss://...`).
- Existing GCP-compatible paths remain as fallback to avoid breaking dev environments.

## 1) Provider readiness checklist
- [x] Vercel project created and linked to this GitHub repo (root directory: `UI/`).
- [x] Neon project/database created.
- [x] Cloudflare R2 bucket created.
- [x] Upstash Redis database created.
- [ ] RunPod Serverless endpoint created (Qwen3-TTS).
- [ ] Resend account/API key ready.

## 2) Manual secrets/env mapping

Use these in **Vercel Project Settings → Environment Variables** (Production + Preview as needed):

### Core app
- `DATABASE_URL` = Neon pooled connection string
- `DIRECT_URL` = Neon direct connection string (for migrations)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Storage (Cloudflare R2)
- `STORAGE_MODE=r2`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT` (S3-compatible endpoint)
- `R2_PUBLIC_URL_BASE` (optional public CDN/domain URL)

### Redis (Upstash)
- `UPSTASH_REDIS_URL` = `rediss://...` URL from Upstash
- Optional fallback: `REDIS_URL` (same value)

### Voice / TTS (RunPod)
- `TTS_SERVICE_URL` = your RunPod HTTP endpoint base URL
- `TTS_SERVICE_TOKEN` = token expected by your TTS gateway
- `RUNPOD_API_KEY` = if your TTS adapter calls RunPod API directly

### Email
- `RESEND_API_KEY`

## 3) One-time platform setup steps
1. **Vercel**
   - Link repo and set root directory to `UI/`.
   - Ensure build command is `npm run build`.
2. **Neon**
   - Create DB and run: `CREATE EXTENSION IF NOT EXISTS vector;`.
3. **Cloudflare R2**
   - Create bucket `heard-again-prod` (or your chosen name).
   - Add CORS rules permitting your Vercel production domain and preview domains.
4. **Upstash**
   - Choose region near Vercel deployment region.
   - Copy TLS URL (`rediss://...`) into `UPSTASH_REDIS_URL`.
5. **RunPod**
   - Deploy Qwen3-TTS template.
   - Configure callback/webhook URL to `https://<your-domain>/api/webhooks/tts`.

## 4) Database migration runbook
Use `DIRECT_URL` when running migrations from CI/CD or locally.

```bash
cd UI
DIRECT_URL='postgresql://...' DATABASE_URL='postgresql://...' npx prisma migrate deploy --schema=../prisma/schema.prisma
```

If `prisma/schema.prisma` changes, run:

```bash
npx prisma generate --schema=prisma/schema.prisma
```

## 5) Verification protocol
1. Health:
```bash
curl -X GET https://<vercel-domain>/api/health
```
2. Prisma migration sync:
```bash
cd UI
DATABASE_URL='postgresql://...' npx prisma migrate status --schema=../prisma/schema.prisma
```
3. Voice lab E2E:
- Trigger a narration/voice flow from UI.
- Confirm: Vercel API -> RunPod TTS -> persisted asset in R2 -> playback from app.

## 6) Cleanup (manual)
After Vercel deployment is stable:
- Delete or archive `cloudbuild.yaml`.
- Disable old GCP Cloud Build triggers.
- Decommission GKE/Cloud Run services that are no longer used.
