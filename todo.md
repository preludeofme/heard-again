## Narration System — Architecture Review Findings

### Critical
[x] [CRITICAL] Fix mangled R2 key in persistAsset — narrationWorker.ts:92 — audioId from RunPod is the full R2 key ("generated-audio/fid/uuid.mp3") but is passed as the filename with an extension appended, then prefixed with the folder again, producing a double-nested key like "generated-audio/fid/generated-audio/fid/uuid.mp3.mp3". Extract just the UUID portion for the filename.
[x] [CRITICAL] BullMQ lockDuration is 5 min (narrationWorker.ts:337) but long stories can exceed that — BullMQ marks stalled jobs failed and retries, causing double-synthesis. Raise lockDuration to 15 min or call job.extendLock() during onProgress.

### High
[x] [HIGH] upload-status.ts hardcodes new RunPodTTSProvider() instead of getTTSProvider() — bypasses TTS_PROVIDER env var; will throw if provider is switched to rest and RUNPOD_TTS_ENDPOINT_ID is unset.
[x] [HIGH] WebSocket global not guaranteed in Node 18 — runpod-tts-provider.ts:185 falls back to polling on ReferenceError but adds latency per job. Import from ws package or use globalThis.WebSocket fallback.
[x] [HIGH] R2 staging files (tts-staging/{familyspaceId}/*) are never deleted after upload_reference processing. Add cleanup in the Python handler after successful upload, or set an R2 lifecycle rule to expire tts-staging/ after 24h.
[x] [HIGH] Sentence splitting in runpod_handler.py uses a naive regex that splits on abbreviations and initials (Dr., Jr., U.S.) — common in family stories. Replace with nltk.sent_tokenize or spacy.

### Medium
[x] [MEDIUM] Consent failure (VOICE_CONSENT_REQUIRED) thrown in narrationWorker marks the job FAILED but the error string is not surfaced clearly in the narration-jobs polling response. UI shows a generic failure with no actionable message.
[x] [MEDIUM] enqueueNarrationRender removes an in-flight queue job when superseded by a new render for the same (storyId, voiceProfileId), but the original VoiceGenerationJob in the DB stays PROCESSING forever. Mark the superseded DB job FAILED with a "superseded" reason before removing the queue entry.
[x] [MEDIUM] Content selection is inconsistent: save-narration.ts uses narratedContent only if narrationStatus === APPROVED; narrationWorker.ts uses narratedContent regardless of status. Worker should mirror the API's selection logic until the narration/original toggle is built.
[x] [MEDIUM] No DB index on Asset.metadata JSON path — sibling-prune and cached-asset queries both use { metadata: { path: ['storyId'], equals: storyId } } which is a full table scan. Add a GIN index on metadata in a Prisma migration.

### Low
[x] [LOW] SynthesisCompleteEvent.audioUrl is an R2 object key, not an HTTP URL (set to audio_id in runpod_handler.py). Field is unused in the worker today but will silently break any future consumer expecting a real URL. Rename to audioKey or populate a proper presigned URL.
[x] [LOW] getTTSProvider() is a module-level singleton — if TTS_PROVIDER env var changes, the narration worker process must be restarted. Document this in the provider-switching runbook.



## Misc Updates



[ ] email sign up csrf
[ ] Need to add a +Add to the family tree nodes so the user can add a new family member from that node 
[ ] need toggle for using the narration version of the story or the original for the voice generation. That way someone can choose to generate/listen to each one if they want
[ ] Look into vercel's malware scanner if there is one as alternative to CLAMAV
[x] Add whisper to runpod container 
[ ] comments on a story are posted as anonymous instead of tying to the user's profile/identity
[ ] need to make sure when commenting and posting stories that it's connecting to the person record (family tree) rather than just the user (authenticated user) that way someone can click on the name from a comment and it will take them to the family record/profile 

