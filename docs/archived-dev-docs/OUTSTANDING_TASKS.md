# Outstanding Tasks

Generated 2026-05-20 from review of docs/*.md (excluding subfolders).

---

## Code — Missing Implementation

### 1. RunPod worker `handler.py` not in repo
**Source:** [TTS_SERVERLESS_REDESIGN.md](TTS_SERVERLESS_REDESIGN.md#runpod-worker-requirements-python)

The TypeScript RunPod provider (`UI/src/lib/tts/runpod-tts-provider.ts`) is implemented and the upload pipeline uses it, but there is no Python worker in the repository to deploy to RunPod. Without it, `TTS_PROVIDER=runpod_serverless` will submit jobs to an endpoint that has no handler.

The worker must implement three actions dispatched via `input.action`:
- `upload_reference` — download from R2, run Whisper transcription, return file metadata
- `synthesize_batch` — synthesize audio, stream progress events, upload result to R2
- `download_audio` — return audio as base64 (pod-mode only; not needed when R2 is the transport)

Full input/output schemas are in [TTS_SERVERLESS_REDESIGN.md](TTS_SERVERLESS_REDESIGN.md#actions).

**Expected location:** `RunPod/worker/handler.py`

---

## Manual / Infrastructure

### 2. Update Google OAuth credentials to production
**Source:** [prod-updates.md](prod-updates.md#L12) — the one unchecked item

The app is using dev-tier Google OAuth client ID/secret in production. Update in:
- Google Cloud Console → OAuth 2.0 Credentials → create or promote a production client
- Vercel → Project Settings → Environment Variables → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

### 3. Set `TTS_PROVIDER` and `RUNPOD_TTS_ENDPOINT_ID` in Vercel
**Source:** [LOCAL_INFRA_GAP_ANALYSIS.md](LOCAL_INFRA_GAP_ANALYSIS.md#7-tts_provider-not-set-in-vercel-env-)

Without these, `UI/src/lib/tts/index.ts` defaults to the REST provider and routes requests to `TTS_SERVICE_URL` using the wrong request shape, producing 404s against the RunPod API.

```
TTS_PROVIDER=runpod_serverless
RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3
```

---

### 4. Fix `CHAT_SYSTEM_URL` in Vercel to bare base URL
**Source:** [LOCAL_INFRA_GAP_ANALYSIS.md](LOCAL_INFRA_GAP_ANALYSIS.md#8-chat_system_url-format-issue-in-envvercel-)

Currently set to `https://heardagain.com/api/chat`. Chat proxy routes append their own paths, producing doubled paths like `.../api/chat/api/chat/sessions`. Must be the bare base URL with no trailing path.

```
CHAT_SYSTEM_URL=https://<chat-service-base-url>
```

---

### 5. Set Cloudflare R2 CORS policy for direct browser uploads
**Source:** [VOICE_UPLOAD_PIPELINE.md](VOICE_UPLOAD_PIPELINE.md#cloudflare-r2-bucket-cors-policy)

Without this, the browser's presigned PUT to R2 fails on the preflight OPTIONS request. The upload flow (step 2: browser → R2) will silently error.

```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Set in: Cloudflare Dashboard → R2 → bucket → Settings → CORS Policy.

---

## Verified Complete

| Document | Status |
|---|---|
| VOICE_UPLOAD_PIPELINE.md | All code implemented |
| LOCAL_INFRA_GAP_ANALYSIS.md | All code items done; 2 Vercel env vars outstanding (items 3–4 above) |
| prod-updates.md | All items done except Google OAuth (item 2 above) |
| TTS_SERVERLESS_REDESIGN.md | All TypeScript files exist; Python worker missing (item 1 above) |
| VERCEL_DEPLOYMENT_FIXES.md | All work implemented; documentation only |
