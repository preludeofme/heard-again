# Story Narration — Streaming Playback Plan

**Status:** Proposed
**Owner:** `ryan@trubuckdesign.com`
**Date:** 2026-04-23
**Scope:** Add the ability to have a saved story narrated in a cloned family voice, with optional LLM-polished first-person text, streamed on demand (no default persistence), with an opt-in "Save as audio file" path.

---

## 1. Goals

- Let a user press ▶ on a story and hear it in the voice of the subject (or a selected voice profile).
- Offer an **opt-in** LLM pre-processing step that rewrites third-person stories into first-person as if the subject were telling the story themselves.
- **Always preserve** the original written content. The rewrite lives in a separate field; the display page shows the original.
- **Stream** the narration so we do not store a WAV for every playback. Time-to-first-audio ≤ ~4s on local GPU.
- Give the user an explicit **"Save as audio"** button that persists a single complete render as a downloadable Asset when they want one.

## 2. Non-Goals

- Real-time sub-second TTS streaming (Qwen3-TTS is utterance-based, not token-streaming).
- Seeking / scrubbing inside a stream. Streamed playback is forward-only.
- Multiple concurrent narration versions per story. One current rewrite, one current approval state.
- Ingesting narration audio into ChromaDB or persona memory.

## 3. User Flow

### 3.1 Opt-in preparation (save-time, not automatic)

1. On the story detail page, if `narrationStatus = NONE`, show an opt-in banner:
   > **Have [Subject] tell this story in their own voice.**
   > We can polish the text into first-person (e.g., "I remember…") so the narration sounds like they're telling it. You'll review the rewrite before anything is narrated. Your original story stays untouched.
   > **[ Prepare narration ]**
2. Clicking triggers `POST /api/stories/[id]/rewrite-first-person`.
   - UI shows a progress state ("Preparing…").
   - Server sets `narrationStatus = PENDING`, calls Chat service LLMGateway, stores result in `narratedContent`, sets `narrationStatus = READY`.
3. The banner transitions to a **Review** state:
   - Side-by-side (or stacked on mobile) comparison: **Original** vs **Proposed narration**.
   - User can edit `narratedContent` inline.
   - Actions: **Approve** → `narrationStatus = APPROVED`. **Discard** → clears `narratedContent`, status back to `NONE`. **Re-polish** → re-runs LLM.

### 3.2 Playback (streaming, default)

1. Once `narrationStatus = APPROVED` (or the user picks "Narrate original text" from the overflow menu), a player appears on the story page with ▶, voice selector, and a download button.
2. Pressing ▶ hits `GET /api/stories/[id]/narrate?voiceProfileId=X` which returns a chunked MP3 stream.
3. UI proxies to TTS `/api/tts/synthesize-stream`, which:
   - Splits the text into sentences.
   - Synthesizes each sentence with Qwen3-TTS.
   - Encodes each WAV → MP3 via `pydub`/ffmpeg.
   - Yields MP3 bytes to the response as each sentence finishes.
4. Browser plays the stream from a single `<audio>` element. Forward-only. A `VoiceGenerationJob` row is created for audit/metering with `outputAssetId = null`.

### 3.3 Save as audio (download, explicit)

1. "Save this narration" button next to the player.
2. Triggers `POST /api/stories/[id]/save-narration` → reuses existing `voiceService.synthesize()` → persists a single WAV `Asset` (type `GENERATED_AUDIO`) and populates `Story.generatedAudioAssetId`.
3. UI exposes download link via `/api/assets/[id]/download`.
4. If a saved asset already exists, this becomes "Replace saved narration".

### 3.4 Editing the original story (staleness)

1. When the user edits `Story.content` via `PUT /api/stories/[id]`, if `narratedContent` is non-null the server sets `narrationStatus = STALE`.
2. The story edit page detects the change before save and prompts:
   > This story has a reviewed narration. Your edits will make it out-of-date.
   > **[ Keep existing narration ]   [ Regenerate after saving ]**
3. On save: either the status is set to `STALE` (keep), or the server queues a fresh rewrite after the update (regenerate).
4. Stale banner on detail page offers **Re-polish** or **Keep** (manual mark APPROVED).

## 4. Schema Changes

`prisma/schema.prisma` — add to `Story`:

```prisma
model Story {
  // … existing fields …

  // Narration (first-person rewrite used for TTS)
  narratedContent         String?
  narrationStatus         NarrationStatus  @default(NONE)
  narrationModel          String?         // e.g. "llama3.1:8b"
  narrationUpdatedAt      DateTime?
  narrationApprovedAt     DateTime?
  narrationApprovedById   String?
  narrationApprovedBy     User?   @relation("StoryNarrationApprover", fields: [narrationApprovedById], references: [id])

  @@index([narrationStatus])
}

enum NarrationStatus {
  NONE        // no rewrite exists
  PENDING     // LLM rewrite in progress
  READY       // LLM rewrite done, awaiting user review
  APPROVED    // user approved; used for playback
  STALE       // content changed after approval
  FAILED      // LLM call errored
}
```

Retain `generatedAudioAssetId` — used only by the explicit "Save as audio" path; null by default.

Migration name: `add_story_narration_fields`.

## 5. New & Changed API Endpoints

### UI service (`/UI/src/pages/api`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/stories/[id]/rewrite-first-person` | Trigger LLM rewrite. Sets status PENDING→READY or FAILED. CSRF-protected, EDITOR role. |
| PATCH | `/api/stories/[id]/narration` | Update `narratedContent`, set status (APPROVED, NONE on discard). CSRF-protected. |
| GET | `/api/stories/[id]/narrate` | **Streams** MP3 audio. Requires voiceProfileId (query or uses Story.voiceProfileId). Content-Type: audio/mpeg, Transfer-Encoding: chunked. Source text = `narratedContent` if APPROVED else `content`. Creates VoiceGenerationJob for audit. |
| POST | `/api/stories/[id]/save-narration` | Full synthesis → persists Asset → sets `Story.generatedAudioAssetId`. Reuses `voiceService.synthesize()`. |
| PUT | `/api/stories/[id]` (existing) | If `content` changes and `narratedContent` exists, set `narrationStatus = STALE`. Accept optional `regenerateNarration: boolean` body flag to kick off an async rewrite after save. |

### Chat service (`/Chat/src/pages/api`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rewrite/first-person` | Service-to-service endpoint called only by UI. Body: `{ content, subjectName?, speakerName?, styleHints? }`. Returns `{ rewrittenContent, model }`. Uses `LLMGatewayImpl.generateResponse()` with a carefully constrained system prompt. |

### TTS service (`/TTS/app`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/tts/synthesize-stream` | Chunked MP3 response. Body: `{ profileId, text, language, workspaceId }`. Splits text into sentences server-side, encodes each WAV→MP3, yields frames. |

## 6. LLM Rewrite Prompt (Design)

System prompt (initial draft — tune in evals):

```
You are rewriting a family memory so the subject of the story can narrate it in their own voice, in first person. The original text was written by a family member ABOUT the subject.

Rules (absolute):
1. Do not invent facts. Only use information present in the ORIGINAL TEXT.
2. Do not add feelings, opinions, or memories that were not written.
3. Preserve every name, date, place, and quoted dialogue exactly.
4. Rewrite perspective from third-person to first-person, as if {subjectName} is telling this story aloud to their family today.
5. Convert "they/he/she" references to the subject into "I/me/my" where they refer to {subjectName}. Other people stay in third person.
6. Keep the original pacing and emotional register. Do not dramatize.
7. Write in plain spoken English, the way someone speaks aloud. No stage directions, no headings, no meta commentary. Just the story.
8. If the original is already in first person, return it nearly verbatim with only minor cleanup for spoken cadence.

Return only the rewritten story. No preamble. No markdown.
```

Model: configurable via env `NARRATION_LLM_MODEL`, defaults to the Chat service `RELEASE_CANDIDATE_MODEL_POLICY.primaryModel`. Temperature `0.3` (low — we want faithful rewrites, not creative writing).

## 7. TTS Streaming Implementation

### 7.1 Sentence chunking

- Simple regex-based splitter in `TTS/app/text_chunker.py`: split on `[.!?]` followed by whitespace, respect abbreviations (`Mr.`, `Dr.`, `Mrs.`, `St.`, `etc.`).
- Enforce max chunk length (~200 chars); long sentences get split at commas.
- Preserves whitespace/newlines between sentences.

### 7.2 MP3 encoding

- Add `pydub==0.25.1` to `TTS/requirements.txt`.
- ffmpeg is already installed on dev host (verified at `/usr/bin/ffmpeg`). Ensure `ffmpeg` is in the TTS Docker image.
- Encode each sentence: `AudioSegment(raw_pcm).export(BytesIO, format="mp3", bitrate="128k")`. MP3 frames are independently playable so concatenation-on-wire works.

### 7.3 FastAPI StreamingResponse

```python
@app.post("/api/tts/synthesize-stream")
async def synthesize_stream(...):
    def generate():
        for sentence in chunk_text(req.text):
            wav, sr = model_manager.synthesize_from_profile(...)
            mp3_bytes = encode_mp3(wav, sr)
            yield mp3_bytes
    return StreamingResponse(generate(), media_type="audio/mpeg")
```

- Watermarking/metadata: MP3 ID3 tag added to first chunk with `aiGenerated=true` + workspaceId + jobId.
- Logged via same `log_auth_event` path as `/synthesize`.

## 8. UI Streaming Proxy

`UI/src/pages/api/stories/[id]/narrate.ts`:

1. Auth user, resolve workspace, EDITOR role not required — VIEWER is fine for playback.
2. Load story. Pick text: `narratedContent` if `narrationStatus = APPROVED`, else `content`.
3. Resolve voice profile (query param → Story.voiceProfileId → default for subject).
4. Check `VoiceConsent` (same logic as `voiceService.checkVoiceConsent`).
5. Create `VoiceGenerationJob` (status PROCESSING, no output asset).
6. `fetch()` TTS `/synthesize-stream` with `Bearer ${TTS_SERVICE_TOKEN}`, proxy the stream back to the client.
7. On stream close: mark job COMPLETED with `computeTimeSeconds`. On error: FAILED.

## 9. Frontend Changes

### 9.1 Story detail page (`UI/src/pages/stories/[id].tsx`)

- Replace the existing `AudioPlayer` gated on `story.generatedAudio` with a new `<StoryNarrationPlayer>` component that:
  - Hits `/api/stories/[id]/narrate?voiceProfileId=…` as its `<audio src>`.
  - Includes voice-profile selector (dropdown of the workspace's READY profiles).
  - Shows "AI-generated" disclosure per existing `AudioPlayer` contract.
  - Exposes a "Save as audio" button → `POST /api/stories/[id]/save-narration` → refreshes with `generatedAudioAssetId` and shows a "Download" link via `/api/assets/[id]/download`.
- Add the **narration preparation banner** (sections 3.1, 3.4) above the story content when `narrationStatus ∈ {NONE, STALE}`.
- Add the **review UI** when `narrationStatus = READY`.

### 9.2 Story edit page (`UI/src/pages/stories/[id]/edit.tsx`)

- Before submitting save, if the story has a narration (`narratedContent` non-null) AND `content` has changed, show a dialog:
  > Keep existing narration (it will be marked out-of-date) · Regenerate after saving
- Pass `regenerateNarration` flag in the PUT body based on user choice.

### 9.3 New components

- `UI/src/components/stories/NarrationPreparationBanner.tsx`
- `UI/src/components/stories/NarrationReviewPanel.tsx`
- `UI/src/components/stories/StoryNarrationPlayer.tsx`

## 10. Security & Safety

- Every new endpoint goes through existing `getAuthUserWithWorkspace` + `withCSRFProtection` where it mutates state.
- LLM rewrite respects workspace boundaries: Chat service is passed only the content of that one story, nothing else.
- Voice consent check runs on both `/narrate` and `/save-narration` — existing `checkVoiceConsent()` logic.
- `VoiceGenerationJob` written for every stream (auditability) even though no asset is produced.
- AI-generated disclosure remains on the player UI. ID3 metadata tags MP3 stream as AI-generated.
- Rate limiting: reuse existing middleware; narration endpoints fall under the existing voice bucket.
- CSP note: `<audio>` streaming from a same-origin API route is fine; no CSP changes needed.

## 11. Cost / Performance

- Sentence-chunked synth on local GPU: ~1.5–3s per sentence. A 10-sentence story = ~20s total compute, but time-to-first-audio is ~2–3s.
- Every playback pays full compute. No cache. "Save as audio" is the cache if a user listens to the same story repeatedly.
- LLM rewrite: ~5–15s on local Ollama for a typical story (`llama3.1:8b`). Run once at opt-in, reuse forever.

## 12. Observability

- Structured log lines on rewrite start/finish with storyId, model, tokens, durationMs.
- Structured log on stream start/end with storyId, voiceProfileId, sentences, totalComputeSeconds.
- `VoiceGenerationJob` rows remain the source of truth for usage analytics.

## 13. Feature Flags & Rollout

- `AUDIO_GENERATION_ENABLED` (existing, UI) — gates both the legacy `/generate-audio` endpoint and the new narration endpoints.
- `NARRATION_REWRITE_ENABLED` (new, UI) — lets us ship narration playback before the LLM rewrite is wired up.
- No new Chat service flag; rewrite endpoint guarded by `CHAT_SERVICE_SECRET`.

## 14. Testing Approach

- Unit tests for sentence chunker (`text_chunker.py`).
- Integration test for `/rewrite-first-person` against a mocked Ollama response.
- Playwright E2E: open a story → prepare narration → approve → press play → audio element has non-zero duration after 10s.
- Manual GPU smoke: stream a 500-word story, verify time-to-first-audio and no truncation between sentences.

## 15. Deliverables (implementation order)

1. Plan doc (this file). ✅
2. Prisma migration + regenerate client.
3. Chat service rewrite service + route.
4. UI proxy `POST /rewrite-first-person` + `PATCH /narration`.
5. Review UI components + wiring on story detail page.
6. TTS service: `text_chunker.py`, MP3 encoder helper, `/synthesize-stream` endpoint, Docker image update.
7. UI proxy `GET /narrate` (streams).
8. `StoryNarrationPlayer` component.
9. `POST /save-narration` + download UI.
10. Edit-page stale prompt + `PUT` staleness handling.
11. Tests + memory updates.

---
