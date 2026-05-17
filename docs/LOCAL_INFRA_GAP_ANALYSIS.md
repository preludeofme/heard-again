# Local Infrastructure Gap Analysis

> Generated: 2026-05-17  
> Context: Post-cloud migration audit — identify what's needed to run locally with full prod parity via env vars only.

---

## Critical — Will throw errors at runtime

### 1. `ENCRYPTION_KEY` missing from `UI/.env`

`UI/src/lib/security/field-encryption.ts:24` throws `ENCRYPTION_KEY environment variable is required` if this is absent and field encryption is triggered. Production has it set; local does not.

**Fix:** Add to `UI/.env`:
```bash
ENCRYPTION_KEY=77f18b1e5d867b72d1a367a6c4cfdb1b14725177b435d061c459da32879a9a07
```

---

### 2. `TRIGGER_SECRET_KEY` missing from `UI/.env`

The Trigger.dev SDK authenticates against the cloud using this key. Without it, `narrationTask.trigger()` (`pages/api/stories/[id]/narrate.ts:256`) and `gedcomImportTask.trigger()` fail with auth errors. `AUDIO_GENERATION_ENABLED` gating protects the narrate route, but the GEDCOM import has no equivalent gate.

**Fix:** Add to `UI/.env`:
```bash
TRIGGER_SECRET_KEY=<dev secret key from Trigger.dev dashboard → Project → API Keys>
```

---

### 3. No Trigger.dev dev server in `Scripts/start-dev.sh`

The startup script calls `npm run workers:start` — confirmed dead code. `UI/src/workers/start-workers.ts` logs "no active workers (all tasks on Trigger.dev)" and exits. Both the narration task and GEDCOM import task now run exclusively via Trigger.dev. Without `npx trigger.dev@latest dev` running locally, triggered tasks queue in the cloud and never execute against the local database.

**Fix:** In `Scripts/start-dev.sh`, replace the `workers:start` block with:
```bash
cd "$MAIN_APP_DIR"
npx trigger.dev@latest dev &
TRIGGER_PID=$!
echo $TRIGGER_PID >> "$PIDS_FILE"
```

---

## Important — Features silently broken locally

### 4. `AUDIO_GENERATION_ENABLED=true` not set in `UI/.env`

`pages/api/stories/[id]/narrate.ts:58` returns `503 Audio generation is not yet available` unless this flag is explicitly `true`. Audio generation is dead locally without it.

**Fix:** Add to `UI/.env`:
```bash
AUDIO_GENERATION_ENABLED=true
```

---

### 5. `NARRATION_LLM_PROVIDER` / `OPENAI_API_KEY` missing from `UI/.env`

`UI/src/lib/narration-llm-client.ts:1` defaults to `openai` as the provider. No `OPENAI_API_KEY` is set in `UI/.env`, so any narration LLM call fails with a 401. Ollama is already running locally and configured in `Chat/.env`.

**Fix:** Add to `UI/.env` (choose one):
```bash
# Option A — use local Ollama (already running)
NARRATION_LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434

# Option B — use OpenAI (requires key)
NARRATION_LLM_PROVIDER=openai
OPENAI_API_KEY=<your key>
```

---

### 6. `REDIS_URL` missing from `UI/.env`

The startup script starts a `redis-dev` Docker container on port 6379, but `UI/.env` never tells the app about it. `UI/src/lib/redis-client.ts:3` checks `UPSTASH_REDIS_URL || REDIS_URL` — both are unset, so rate limiting silently no-ops locally. This is a graceful degradation but not prod parity.

**Fix:** Add to `UI/.env`:
```bash
REDIS_URL=redis://localhost:6379
```

---

## Production Gaps — Vercel env likely misconfigured

### 7. `TTS_PROVIDER` not set in Vercel env

`UI/src/lib/tts/index.ts:10` defaults to `rest` if `TTS_PROVIDER` is unset. The REST provider appends paths like `/api/tts/upload-reference` to `TTS_SERVICE_URL`. In production, `TTS_SERVICE_URL` points to the RunPod API which has a completely different request shape — this will produce 404s or malformed requests. The RunPod provider (`runpod-tts-provider.ts`) uses `RUNPOD_TTS_ENDPOINT_ID` and the RunPod base URL directly, not `TTS_SERVICE_URL`.

**Fix:** Add to Vercel environment variables:
```bash
TTS_PROVIDER=runpod_serverless
RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3
```

---

### 8. `CHAT_SYSTEM_URL` format issue in `.env.vercel`

Currently set to `https://heardagain.com/api/chat`. The chat proxy routes append their own paths to this value — e.g. `sessions.ts` calls `${chatSystemUrl}/api/chat/sessions`, producing the double-path URL `https://heardagain.com/api/chat/api/chat/sessions`. The value should be the bare base URL of wherever the Chat service is deployed (no trailing path segment).

**Fix:** Update `CHAT_SYSTEM_URL` in Vercel to the Chat service's base URL:
```bash
CHAT_SYSTEM_URL=https://<chat-service-base-url>   # no trailing /api/chat
```

---

## Minor — Cleanup / Cosmetic

### 9. `workers:start` in startup script is dead code

`Scripts/start-dev.sh` still prints `✓ Narration Worker started` and tracks the PID, but the process does nothing meaningful. `start-workers.ts` confirms: *"no active workers (all tasks on Trigger.dev)"*. This should be replaced with the Trigger.dev dev server (see item 3).

---

### 10. `APP_KEY` missing from `UI/.env`

`UI/src/lib/security/mfa-service.ts:259` falls back to `NEXTAUTH_SECRET` when `APP_KEY` is absent. `NEXTAUTH_SECRET` is set in `UI/.env`, so this is not critical — but it creates env divergence from production.

**Fix:** Add to `UI/.env` (optional):
```bash
APP_KEY=2ae9018dc67454cb4ee2858cb6e4a650fc242579d1c4e3fa30b7976c3648d49d
```

---

## Summary Checklist

### `UI/.env` — add these vars

| Var | Value | Priority |
|-----|-------|----------|
| `ENCRYPTION_KEY` | (from `.env.vercel`) | **Critical** |
| `TRIGGER_SECRET_KEY` | (from Trigger.dev dashboard) | **Critical** |
| `AUDIO_GENERATION_ENABLED` | `true` | Important |
| `NARRATION_LLM_PROVIDER` | `ollama` or `openai` | Important |
| `OLLAMA_URL` | `http://localhost:11434` | Important (if ollama) |
| `REDIS_URL` | `redis://localhost:6379` | Important |
| `TTS_PROVIDER` | `rest` | Explicit clarity |
| `APP_KEY` | (from `.env.vercel`) | Minor |

### `Scripts/start-dev.sh` — swap dead worker for Trigger.dev dev server

Replace `npm run workers:start` block with `npx trigger.dev@latest dev`.

### Vercel env — prod-side fixes

| Var | Value | Priority |
|-----|-------|----------|
| `TTS_PROVIDER` | `runpod_serverless` | **Critical** |
| `RUNPOD_TTS_ENDPOINT_ID` | `gjtkiwlc3ja3y3` | **Critical** |
| `CHAT_SYSTEM_URL` | bare base URL (no path) | Important |
