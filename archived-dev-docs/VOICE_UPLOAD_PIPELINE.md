# Voice Upload Pipeline — Vercel + RunPod Serverless

Documenting the full rework of the voice sample upload flow done in May 2026.

---

## Problem Statement

The original upload flow POSTed the audio file directly through a Vercel serverless function, which then:
1. Validated and malware-scanned the file
2. Forwarded the bytes to RunPod via the TTS provider
3. Blocked while Whisper transcribed the audio (could take minutes)
4. Returned once transcription was complete

This caused three distinct failures in production:

| Error | Root Cause |
|---|---|
| `ENOENT: mkdir './uploads'` | `STORAGE_MODE=local` set in Vercel; `LocalStorageProvider` tried to write to the read-only filesystem |
| `ERR_NETWORK_CHANGED` | RunPod's `/runsync` endpoint blocked the HTTP connection for the full Whisper transcription. If the user's network changed, the connection dropped |
| `ERR_SOCKET_NOT_CONNECTED` | Vercel's 4.5 MB request body limit — large audio files never reached the function |

---

## Solution: Direct-to-R2 + Async RunPod

The upload is now a three-step client-driven flow that keeps Vercel functions small and fast.

### Flow

```
1. POST /api/voice/request-upload   (tiny JSON, < 1ms Vercel work)
   → server generates presigned R2 PUT URL + creates PENDING Asset record
   → returns { assetId, uploadUrl }

2. Browser PUT → R2 presigned URL    (bypasses Vercel entirely, no size limit)
   → file lands in tts-staging/<familyspaceId>/<uuid>.<ext>

3. POST /api/voice/process-upload    (tiny JSON)
   → server fetches presigned GET URL for the staged file
   → submits RunPod async /run job with { action: 'upload_reference', audioUrl }
   → updates Asset to PROCESSING, stores runpodJobId in metadata
   → returns { runpodJobId }

4. Client polls GET /api/voice/upload-status?assetId=&runpodJobId=  (every 3s)
   → server checks RunPod job status, caches result to Asset on completion
   → returns { complete, data } | { status: 'processing' } | { failed, error }
```

### Key files

| File | Role |
|---|---|
| `UI/src/pages/api/voice/request-upload.ts` | Generates presigned R2 PUT URL, creates PENDING Asset |
| `UI/src/pages/api/voice/process-upload.ts` | Submits RunPod async job from R2 URL, idempotent on retry |
| `UI/src/pages/api/voice/upload-status.ts` | Polls RunPod job status, caches completion to Asset |
| `UI/src/lib/tts/runpod-tts-provider.ts` | `submitUploadReferenceFromUrl()` — submits RunPod job with an audioUrl instead of a buffer |
| `UI/src/lib/tts/tts-provider.types.ts` | `UploadReferenceJob` type, optional async methods on `TTSProvider` |
| `UI/src/controllers/useVoiceTraining.ts` | Client-side orchestration, retry logic, offline handling |

---

## Additional Fixes

### Storage double-path bug
`StorageService.generateFilename()` was embedding the folder in the filename string, then `S3StorageProvider.uploadFile()` also prepended `options.folder`, producing R2 keys like `tts-staging/id/tts-staging/id/file.wav`. Fixed by removing folder from `generateFilename` — folder is handled exclusively by the S3 provider.

### narrationWorker hardcoded LOCAL storage
`narrationWorker.ts` imported `storageService` from `@/services/StorageService`, a second `StorageService` class hardcoded to `type: 'LOCAL'` with `basePath: process.cwd()`. Fails on Vercel. Replaced with `getStorageService()` from `@/lib/storage/storage-service` which respects `STORAGE_MODE`.

### Chat service ECONNREFUSED flooding logs
`CHAT_SERVICE_URL` was not set in Vercel, falling back to `http://localhost:4778`. Registration was attempted on every upload and logged as an error. Fixed with a guard: only attempt if URL is set and is not a localhost address. Log level changed from `error` to `warn`.

### Content Security Policy blocking R2 PUT
The production CSP `connect-src` was `'self'` only. The browser's `fetch` to the presigned R2 PUT URL was blocked before it reached the network. Fixed by adding `https://*.r2.cloudflarestorage.com` to `connect-src` in `UI/src/lib/security/security-headers.ts`.

---

## Offline / Unstable Network Handling

Added in `useVoiceTraining.ts` to handle hotspot users and mobile connections.

### Upload steps (request-upload, R2 PUT, process-upload)
- Each step retries up to 4 times
- Before each retry, `waitForOnline()` pauses until `navigator.onLine` fires (up to 30s)
- If all retries fail, throws with a clear error message

### Polling (upload-status)
- `TypeError` (network failure) is caught silently — the loop continues
- If `navigator.onLine` is false, shows a persistent "Connection lost — will resume when back online" warning snackbar
- Waits for the `online` event for up to the full remaining deadline (10 min total)
- When back online, dismisses the warning silently and resumes polling
- If offline for the full remaining deadline, throws "Upload timed out. Please try uploading your audio sample again."
- `process-upload` is idempotent: if the asset is already PROCESSING (retry hit a previously submitted job), it returns the existing `runpodJobId`

### waitForOnline utility
```typescript
function waitForOnline(timeoutMs = 60_000): Promise<void>
```
Module-level function (not a hook). Resolves immediately if already online. Attaches a one-shot `online` event listener with an optional timeout.

---

## Required Infrastructure Config

### Cloudflare R2 bucket CORS policy
The browser PUT goes directly to R2. Without CORS, the preflight OPTIONS request will fail.

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

### Vercel environment variables

| Variable | Value |
|---|---|
| `STORAGE_MODE` | `r2` |
| `TTS_PROVIDER` | `runpod_serverless` |
| `RUNPOD_TTS_ENDPOINT_ID` | RunPod endpoint ID |
| `RUNPOD_API_KEY` | RunPod API key |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |

---

## Commits

| Hash | Description |
|---|---|
| `5290ef2` | feat(voice): async two-phase upload for RunPod Whisper transcription |
| `3f0485d` | feat(voice): direct-to-R2 upload bypasses Vercel 4.5MB body limit |
| `99ae1bd` | fix(voice): retry transient network failures in upload flow |
| `3c6c4d1` | fix(voice): resilient offline handling for hotspot / unstable connections |
| `16d51cb` | fix(voice): remove misleading 'back online' toast, extend offline wait to full deadline |
| `8fd5eec` | fix(csp): allow connect-src to r2.cloudflarestorage.com for direct uploads |
