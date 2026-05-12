# TTS Serverless Redesign Requirements

## Context

The current TTS integration assumes a long-running REST service (FastAPI on a RunPod Pod or local GPU machine). The client appends paths like `/api/tts/upload-reference` and `/api/tts/synthesize-batch` directly to `TTS_SERVICE_URL`, and the narration worker consumes a streaming NDJSON response for real-time progress.

RunPod Serverless does not support this pattern — it accepts a single POST to a job endpoint and returns results asynchronously via polling or WebSocket. This document defines the requirements for a redesign that:

- Supports RunPod Serverless (async job model) as the primary cloud deployment
- Keeps the existing REST provider fully operational for Pod and local development
- Switches between providers via a single environment variable with no code changes

---

## Goals

1. Eliminate idle GPU cost by using RunPod Serverless instead of a persistent Pod
2. Preserve full feature parity (voice upload, transcription, batch synthesis, progress streaming)
3. Keep the REST provider so switching back to a Pod requires only an env var change
4. No changes to the narration queue, job tracking, or database schema

---

## Architecture Overview

### Current (REST Provider)

```
UI (Vercel)
  └─► tts-client.ts (direct fetch)
        └─► TTS_SERVICE_URL/api/tts/upload-reference   (POST)
        └─► TTS_SERVICE_URL/api/tts/synthesize-batch   (POST, streaming NDJSON)
        └─► TTS_SERVICE_URL/api/tts/audio/:id          (GET)
```

### Target (Serverless Provider + REST Provider)

```
UI (Vercel)
  └─► TTSProvider (interface)
        ├─► RestTTSProvider      ← existing behavior, unchanged
        │     └─► TTS_SERVICE_URL (direct REST, Pod or local)
        └─► RunPodTTSProvider    ← new
              └─► RunPod Serverless endpoint
                    ├─► POST /run or /runsync (job submission)
                    ├─► GET  /status/:jobId   (polling)
                    └─► WSS  /ws/:jobId       (streaming progress)
```

Provider is selected via `TTS_PROVIDER` env var. All callers use the interface — zero changes to `narrationWorker.ts`, `upload-sample.ts`, or any route that calls TTS.

---

## Provider Interface

Define in `UI/src/lib/tts/tts-provider.ts`.

```typescript
interface UploadReferenceResult {
  fileId: string
  filePath: string
  fileName: string
  duration: number
  transcript: string | null
}

interface SynthesisProgressEvent {
  type: 'progress'
  sentencesDone: number
  sentencesTotal: number
  lastSentenceSeconds?: number
}

interface SynthesisCompleteEvent {
  type: 'complete'
  audioId: string
  audioUrl: string
  duration: number
  sampleRate: number
  synthesisTime: number
  sentenceCount: number
  format: 'mp3' | 'wav'
  mimeType: string
  fileSize: number
}

interface SynthesisErrorEvent {
  type: 'error'
  message: string
}

type SynthesisEvent = SynthesisProgressEvent | SynthesisCompleteEvent | SynthesisErrorEvent

interface TTSProvider {
  uploadReference(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<UploadReferenceResult>

  synthesizeBatch(
    profileName: string,
    text: string,
    familyspaceId: string,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>
  ): Promise<SynthesisCompleteEvent>

  downloadAudio(audioId: string, familyspaceId: string): Promise<Buffer>
}
```

---

## REST Provider (`RestTTSProvider`)

Wraps the current `tts-client.ts` logic with no behavior changes. This is a refactor, not a rewrite.

- `uploadReference` → POST `TTS_SERVICE_URL/api/tts/upload-reference`
- `synthesizeBatch` → POST `TTS_SERVICE_URL/api/tts/synthesize-batch`, consume streaming NDJSON, call `onProgress` for each progress line
- `downloadAudio` → GET `TTS_SERVICE_URL/api/tts/audio/:audioId`

Active when `TTS_PROVIDER=rest` (default for local dev, Pod deployments).

---

## RunPod Serverless Provider (`RunPodTTSProvider`)

Active when `TTS_PROVIDER=runpod_serverless`.

### Authentication

All RunPod API calls require:
```
Authorization: Bearer <RUNPOD_API_KEY>
```

### Job Submission

Two RunPod endpoints are relevant:

| Endpoint | Use when |
|---|---|
| `POST /v2/:endpointId/runsync` | Short operations (upload + transcribe, expected < 90s) |
| `POST /v2/:endpointId/run` | Long operations (batch synthesis, can exceed 90s) |

Request body:
```json
{
  "input": {
    "action": "upload_reference",
    ...action-specific fields
  }
}
```

### Polling

For `/run` jobs: poll `GET /v2/:endpointId/status/:jobId` on a configurable interval.

```typescript
// Poll config
const POLL_INTERVAL_MS = 1500        // env: RUNPOD_POLL_INTERVAL_MS
const POLL_TIMEOUT_MS  = 10 * 60 * 1000  // env: RUNPOD_POLL_TIMEOUT_MS (10 min)
```

Status values to handle: `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`.

### WebSocket Streaming (for synthesis progress)

RunPod supports WebSocket connections to stream partial outputs as the job runs.

Connection: `wss://api.runpod.ai/v2/:endpointId/ws/:jobId`  
Auth: pass `Authorization: Bearer <RUNPOD_API_KEY>` in the `protocols` header or as a query param per RunPod docs.

The worker emits progress events as partial JSON lines. The `RunPodTTSProvider.synthesizeBatch` method should:

1. Submit the job via POST `/run`
2. Open a WebSocket to `/ws/:jobId`
3. Parse incoming messages as `SynthesisEvent` and call `onProgress` for each progress event
4. Resolve on `complete` event, reject on `error` or disconnect without complete
5. Fall back to polling if WebSocket connection is refused (graceful degradation)

### File Handling for Upload

Audio files cannot be sent as multipart form data to a RunPod job. Two options:

**Option A — R2 pre-upload (recommended for files > 1MB):**
1. UI uploads audio to R2 with a short-lived presigned URL
2. Passes the R2 URL in the job input: `{"action": "upload_reference", "audioUrl": "https://..."}`
3. Worker downloads from R2, processes, stores reference audio

**Option B — Base64 inline (for files ≤ 1MB):**
1. UI base64-encodes the buffer
2. Passes it inline: `{"action": "upload_reference", "audioBase64": "...", "mimeType": "audio/wav"}`

Implementation should try Option B first; if buffer exceeds threshold, use Option A. Threshold: `RUNPOD_INLINE_AUDIO_THRESHOLD_BYTES` (default: 1MB).

### Synthesized Audio Return

For batch synthesis, the completed audio should be returned as an R2 URL or base64, not a file path.

Workers should upload completed audio to R2 and return the object key. `downloadAudio` then fetches from R2 using the existing storage service rather than calling back to the TTS service.

---

## RunPod Worker Requirements (Python)

The worker `handler.py` must implement action-based routing. `input.action` dispatches to the correct function.

### Actions

#### `upload_reference`

Input:
```json
{
  "action": "upload_reference",
  "familyspaceId": "string",
  "audioUrl": "string (R2 presigned URL)",
  "audioBase64": "string (base64, alternative to audioUrl)",
  "mimeType": "string",
  "filename": "string"
}
```

Output:
```json
{
  "fileId": "string",
  "filePath": "string (worker-local path, for pod compatibility)",
  "fileName": "string",
  "duration": 12.4,
  "transcript": "string | null"
}
```

#### `synthesize_batch`

Input:
```json
{
  "action": "synthesize_batch",
  "profileName": "string",
  "text": "string",
  "familyspaceId": "string",
  "language": "English",
  "silencePaddingMs": 200
}
```

Progress output (streamed via WebSocket, one JSON object per line):
```json
{"type": "progress", "sentencesDone": 3, "sentencesTotal": 12, "lastSentenceSeconds": 1.4}
```

Final output:
```json
{
  "type": "complete",
  "audioId": "string",
  "audioUrl": "string (R2 URL)",
  "duration": 45.2,
  "sampleRate": 24000,
  "synthesisTime": 18.1,
  "sentenceCount": 12,
  "format": "mp3",
  "mimeType": "audio/mpeg",
  "fileSize": 720384
}
```

#### `download_audio`

Input:
```json
{
  "action": "download_audio",
  "audioId": "string",
  "familyspaceId": "string"
}
```

Output: `{"audioBase64": "string", "mimeType": "audio/mpeg"}`  
Only needed if audio is stored worker-local (pod mode). When using R2, the UI fetches directly and this action is unused.

### Backward Compatibility

When `TTS_PROVIDER=rest`, the FastAPI routes (`/api/tts/upload-reference`, `/api/tts/synthesize-batch`, `/api/tts/audio/:id`) remain the entry points and the worker action routing is not involved.

---

## Environment Variables

| Variable | Values | Default | Description |
|---|---|---|---|
| `TTS_PROVIDER` | `rest`, `runpod_serverless` | `rest` | Selects active provider |
| `TTS_SERVICE_URL` | URL | `http://127.0.0.1:4779` | Used by REST provider |
| `TTS_SERVICE_TOKEN` | string | — | Auth token for REST provider |
| `RUNPOD_API_KEY` | string | — | Used by RunPod provider |
| `RUNPOD_TTS_ENDPOINT_ID` | string | — | RunPod endpoint ID (not the full URL) |
| `RUNPOD_POLL_INTERVAL_MS` | number | `1500` | Polling interval for job status |
| `RUNPOD_POLL_TIMEOUT_MS` | number | `600000` | Max wait time for a job (10 min) |
| `RUNPOD_INLINE_AUDIO_THRESHOLD_BYTES` | number | `1048576` | Below this: inline base64; above: R2 pre-upload |

Note: `TTS_SERVICE_URL` is no longer used by the RunPod provider. Remove it from the RunPod provider constructor entirely to make misconfiguration obvious.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Job `FAILED` | Throw with worker's `error` message |
| Job `TIMED_OUT` | Throw `TTS_JOB_TIMEOUT` error, narration worker marks job FAILED |
| Poll timeout exceeded | Throw `TTS_POLL_TIMEOUT`, same result |
| WebSocket drops mid-stream | Fall back to polling; if job completes, treat as success |
| R2 pre-upload fails | Throw before submitting job; no orphaned RunPod jobs |
| `RUNPOD_TTS_ENDPOINT_ID` not set | Throw at startup if `TTS_PROVIDER=runpod_serverless` |

---

## Feature Flag / Switching

Switching between providers requires only an env var change and redeploy. No database migrations, no code changes.

| Scenario | `TTS_PROVIDER` | `TTS_SERVICE_URL` |
|---|---|---|
| Local dev (local FastAPI) | `rest` | `http://127.0.0.1:4779` |
| RunPod Pod | `rest` | `https://<pod_id>-4779.proxy.runpod.net` |
| RunPod Serverless | `runpod_serverless` | (unused) |
| Self-hosted (Tailscale) | `rest` | Cloudflare Tunnel URL |

---

## Files to Create / Modify

| File | Action |
|---|---|
| `UI/src/lib/tts/tts-provider.types.ts` | New — shared types and interface |
| `UI/src/lib/tts/rest-tts-provider.ts` | New — wraps existing `tts-client.ts` logic |
| `UI/src/lib/tts/runpod-tts-provider.ts` | New — RunPod job submission, polling, WebSocket |
| `UI/src/lib/tts/index.ts` | New — factory: reads `TTS_PROVIDER`, returns the right provider |
| `UI/src/lib/tts-client.ts` | Keep as-is (used by REST provider internally) |
| `UI/src/workers/narrationWorker.ts` | Replace `streamBatchSynth` and `downloadAudio` calls with provider calls |
| `UI/src/pages/api/voice/upload-sample.ts` | Replace direct TTS fetch with provider `uploadReference` |
| `RunPod/worker/handler.py` | New or update — implement action routing |

---

## Out of Scope

- Changes to the Prisma schema or job tracking tables
- Changes to the narration queue structure
- Changes to the TTS Python model loading or inference logic
- Chat service integration (`CHAT_SERVICE_URL` audio processing registration)
