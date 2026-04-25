# Story Narration — Redesign: Render-then-Play Architecture

**Status:** In progress
**Owner:** `ryan@trubuckdesign.com`
**Date:** 2026-04-24
**Supersedes:** `story-stream-plan.md` (streaming approach)

---

## 1. Why we're redesigning

The original streaming plan (`story-stream-plan.md`) assumed Qwen3-TTS synthesis was 1.5–3s per sentence. Reality on the 4090: **11–21s per sentence**, producing **~2–7s of audio each** — a ratio of ~2.5–3× slower than real-time. No amount of chunk buffering can make streaming smooth when the generator runs slower than playback.

The `/api/tts/synthesize-stream` endpoint also had a subtle bug: its "initial buffer of 2" warmup re-triggered every two segments, batching the stream into pairs rather than warming once and then streaming.

### What we observed
From the last run (4 sentences, 432 chars):
- Total synth time: **56.7s**
- Total audio duration: **~22s**
- Mid-playback gap: ~14s of silence between batch 1 and batch 2

### Hard constraint
Qwen3-TTS is autoregressive codec-token generation. Realistic best case on a 4090 with flash-attn + `torch.compile` is ~1× realtime. That's at the cliff edge where any GPU contention causes audible underrun. **Streaming chunked MP3 over HTTP cannot be made reliably smooth on this hardware.**

## 2. Goals of the redesign

1. **Reliable playback:** no stuttering, no gaps, no race conditions.
2. **Seek + scrub support:** users get real `<audio>` controls with accurate duration.
3. **Fast re-listens:** rendered audio cached and served instantly.
4. **Honest UX:** surface the synthesis wait explicitly with progress feedback instead of hiding it in a stuttering stream.
5. **Fewer moving parts:** one audio path (asset download), not two (stream + save).

## 3. Architecture: render-then-play with background pre-rendering

```
User approves narration
        │
        ▼
PATCH /api/stories/[id]/narration → enqueues BullMQ job
        │
        ▼
narrationWorker picks up job
        │
        ├─▶ TTS /api/tts/synthesize-batch (all sentences, one batched generate)
        │
        ├─▶ writes WAV → encodes MP3 → persists Asset
        │
        └─▶ updates Story.generatedAudioAssetId
        │
        ▼
User presses ▶ → StoryNarrationPlayer polls job state → plays from Asset URL
```

### Key principle
Narration is **pre-computed media**, not a live stream. The "Save as audio" feature becomes the *only* audio path — it's always saved.

## 4. Policy decisions

- **Concurrent renders for the same (story, voice):** deduplicated by BullMQ job key `narration:render:{storyId}:{voiceProfileId}`. Second request attaches to the in-flight job.
- **Voice-profile switch:** triggers a new render job targeting that profile. User sees the "Preparing…" state while it generates.
- **Cache invalidation:** when `narrationStatus` becomes `STALE` (story content edited after approval), the old `generatedAudioAssetId` is cleared; a new render fires on re-approval.
- **Asset retention:** one cached asset per `(storyId, voiceProfileId)`. When a new render for the same combo completes, the old asset is deleted.

## 5. Schema changes

`prisma/schema.prisma`:

```prisma
model Story {
  // … existing fields …

  // Existing:
  // generatedAudioAssetId String?  — points at the cached Asset when rendered

  // New:
  narrationRenderJobId String?  // Active VoiceGenerationJob being tracked for status UI
}
```

Also add a functional index hint via unique constraint to prevent duplicate assets per voice:
```prisma
model Asset {
  // existing fields
  // metadata.voiceProfileId is queried via Prisma JsonFilter; no unique constraint (JSON path index unreliable cross-db)
}
```

Migration name: `add_narration_render_job_tracking`.

## 6. API surface

### Changed
| Method | Path | Behavior |
|---|---|---|
| GET | `/api/stories/[id]/narrate` | If asset cached → 302 to `/api/assets/[id]/download`. Else enqueue job, return `202 { jobId }`. |
| PATCH | `/api/stories/[id]/narration` | On `APPROVED` transition, enqueue render job automatically. |
| POST | `/api/stories/[id]/save-narration` | Becomes a synonym for "ensure render exists" — enqueues if missing, returns immediately. |

### New
| Method | Path | Behavior |
|---|---|---|
| GET | `/api/narration-jobs/[id]` | Returns `{ status, sentencesDone, sentencesTotal, assetId?, errorMessage? }` for polling. |

### Deleted
| Method | Path | Why |
|---|---|---|
| POST | `/api/tts/synthesize-stream` | Streaming approach abandoned. |

### TTS service changes
| Method | Path | Behavior |
|---|---|---|
| POST | `/api/tts/synthesize-batch` (new) | Accepts `{ profileId, sentences: string[], language, workspaceId }`. Runs one batched `generate_voice_clone()` over all sentences, concatenates WAVs, returns JSON with `audioId`. Replaces `/synthesize-stream`. |

Keep existing `/api/tts/synthesize` for single-text synthesis (used by preview flows).

## 7. Worker design

`Chat/src/workers/narrationWorker.ts` (mirror `ingestionWorker.ts`):

```ts
Queue name: 'narration'
Job name: 'render'
Job data: { storyId, workspaceId, voiceProfileId, userId }
Job key (dedupe): `render:${storyId}:${voiceProfileId}`
Concurrency: 1 (single GPU — serialize)
Progress reporting: job.updateProgress({ sentencesDone, sentencesTotal })
```

Worker flow:
1. Load story, voice profile, verify consent.
2. Chunk `story.narratedContent || story.content` into sentences.
3. `VoiceGenerationJob` DB row created with status PROCESSING.
4. Call `POST /api/tts/synthesize-batch` with progress callback via SSE or polling.
5. Persist resulting audio as an `Asset` (`GENERATED_AUDIO` type) — metadata includes `{ storyId, voiceProfileId, source: 'approved' | 'original' }`.
6. Update `Story.generatedAudioAssetId` and clear `Story.narrationRenderJobId`.
7. Mark `VoiceGenerationJob` as COMPLETED with `outputAssetId`.
8. On error: FAILED + errorMessage, clear `Story.narrationRenderJobId`.

## 8. TTS service performance work

1. **Startup warm-up.** After model load, run one throwaway 5-word synth so the first real request doesn't pay CUDA kernel compile cost. First-synth vs second-synth should be within 10%.

2. **Flash-attention visibility.** `_detect_attn()` currently logs at `INFO`. Upgrade startup log to explicitly state `Using FlashAttention 2` or `Using SDPA (fallback)` with recommendation. Fail loudly if FA2 isn't loading and `REQUIRE_FLASH_ATTN=true`.

3. **Optional `torch.compile`.** Env flag `TTS_COMPILE=true`. Compiles `generate_voice_clone` path on first call (~60s). Subsequent calls ~1.5× faster in steady state. Off by default (first-request latency ruins UX if enabled naively); document as a "server warmup" mode.

4. **Batched multi-sentence synth.** Qwen3-TTS's `generate_voice_clone` accepts list-of-texts. Implement `/api/tts/synthesize-batch` that passes all sentences in one call, amortizing Python/PyTorch overhead. Expected 20–30% faster end-to-end for multi-sentence stories.

5. **Concatenation + single MP3 encode.** Concatenate all output WAVs with a tiny silence pad (~150ms) between sentences for natural pacing. Encode once to MP3 with libmp3lame — no Xing header artifacts, accurate duration, seekable.

## 9. Frontend changes

### `StoryNarrationPlayer` state machine

```
  idle ──play──▶ checking
    │               │
    │               ├── asset exists ──▶ ready ──play──▶ playing
    │               │
    │               └── no asset ──▶ rendering ──poll──▶ ready
    │
    └── voice change ──▶ rendering (new profile)

  rendering: poll /api/narration-jobs/[id] every 2s
             show "Preparing narration…  (4 of 10 sentences)"
  ready: standard <audio controls src={assetUrl}> with seek
```

### Component changes
- `StoryNarrationPlayer.tsx`: replace the `new Audio(streamUrl)` flow with:
  - On mount: check `story.generatedAudioAssetId` + active job status from props
  - Render a real `<audio controls>` element once asset is available
  - Show progress card when job is in-flight
- Delete the `?_t=${Date.now()}` cache-busting param (no longer relevant)
- Delete the "Save as audio" button — audio is always saved now; replace with "Download" link

### `NarrationReviewPanel.tsx`
- On "Approve", fire `PATCH /api/stories/[id]/narration` as today
- Server-side, that PATCH now also enqueues the render job
- No UI change beyond a small "Preparing narration in the background…" toast

## 10. Observability

- Structured log on worker: `narration:render start/progress/done/fail` with storyId, voiceProfileId, sentences, totalSeconds.
- `VoiceGenerationJob` row is source of truth for metering.
- TTS service: log synth-per-sentence-per-character to identify slow outliers.

## 11. Rollout

- `AUDIO_GENERATION_ENABLED` still gates everything (existing).
- Feature-flag the worker behind `NARRATION_WORKER_ENABLED=true` so we can disable it at runtime while debugging.
- No new public API surface; internal worker + proxy only.

## 12. Testing

- **Unit:** worker job handler (mock TTS), asset-cache lookup logic, state machine transitions in player
- **Integration:** `PATCH /narration` → job enqueued → asset appears → `GET /narrate` returns 302
- **E2E (Playwright):** approve narration → "Preparing…" appears → audio player appears → seek works
- **Perf smoke:** render a 10-sentence story, verify total wall time and VRAM stable

## 13. Deliverables (implementation order)

1. Plan doc (this file). ✅
2. Schema migration: add `narrationRenderJobId` to Story.
3. TTS service: batched synth endpoint + warm-up + flash-attn visibility.
4. BullMQ worker: `narrationWorker.ts`, queue wiring, dedupe key.
5. UI API: rewrite `/narrate` as cache-or-enqueue, add `/narration-jobs/[id]`, wire `PATCH /narration` to enqueue on APPROVED.
6. UI player rewrite around state machine; delete streaming components.
7. Remove `/api/tts/synthesize-stream`, `text_chunker` streaming usage, old buffer logic.
8. Tests: worker, integration, E2E.
9. Memory + doc updates.

---

## 14. Progress log

Updated inline as each deliverable completes.

- [x] 1. Plan doc
- [x] 2. Schema migration
- [x] 3. TTS batched synth + perf work
- [x] 4. BullMQ narration worker
- [x] 5. UI API changes
- [x] 6. UI player rewrite
- [x] 7. Cleanup: delete streaming path
- [x] 8. Tests
- [x] 9. Memory + doc updates
