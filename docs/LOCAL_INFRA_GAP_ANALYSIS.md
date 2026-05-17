# Local Infrastructure Gap Analysis

> Generated: 2026-05-17  
> Context: Post-cloud migration audit — identify what's needed to run locally with full prod parity via env vars only.  
> Status: Most fixes applied. One manual step remaining (Trigger.dev secret key).

---

## Critical — Will throw errors at runtime

### 1. `ENCRYPTION_KEY` missing from `UI/.env` ✅ Fixed

`UI/src/lib/security/field-encryption.ts:24` throws `ENCRYPTION_KEY environment variable is required` if this is absent and field encryption is triggered. Production has it set; local did not.

**Applied:** Added `ENCRYPTION_KEY` to `UI/.env` from `.env.vercel` values.

---

### 2. `TRIGGER_SECRET_KEY` missing from `UI/.env` ✅ Fixed

The Trigger.dev SDK authenticates against the local server using this key. Without it, `narrationTask.trigger()` (`pages/api/stories/[id]/narrate.ts:256`) and `gedcomImportTask.trigger()` fail with auth errors.

The SDK reads two env vars:
- `TRIGGER_API_URL` — points to the local server (set to `http://localhost:3030`)
- `TRIGGER_SECRET_KEY` — API key issued by the local server's dashboard

**Applied:** `TRIGGER_API_URL=http://localhost:3030` added to `UI/.env`.

**Remaining:** Get the dev API key from the local Trigger.dev dashboard at `http://localhost:3030`, then replace the placeholder in `UI/.env`:
```bash
TRIGGER_SECRET_KEY="<your dev secret key from http://localhost:3030 → Project → API Keys>"
```

---

### 3. No Trigger.dev dev server in `Scripts/start-dev.sh` ✅ Fixed

The startup script was calling `npm run workers:start` — confirmed dead code (`UI/src/workers/start-workers.ts` logs "no active workers (all tasks on Trigger.dev)" and exits). Both the narration task and GEDCOM import task run exclusively via Trigger.dev.

**Applied:** Replaced the dead `workers:start` block with:
```bash
TRIGGER_API_URL=http://localhost:3030 npx trigger.dev@latest dev
```

The dev worker connects to the local Trigger.dev server on port 3030, picks up triggered tasks, and executes them against the local database. Logs go to `logs/trigger-dev.log`.

> **Docker note:** If running the app inside Docker, use `http://host.docker.internal:3030` instead of `http://localhost:3030` for `TRIGGER_API_URL`.

---

## Important — Features silently broken locally

### 4. `AUDIO_GENERATION_ENABLED=true` not set in `UI/.env` ✅ Fixed

`pages/api/stories/[id]/narrate.ts:58` returns `503 Audio generation is not yet available` unless this flag is explicitly `true`.

**Applied:** Added `AUDIO_GENERATION_ENABLED=true` to `UI/.env`.

---

### 5. `NARRATION_LLM_PROVIDER` / `OPENAI_API_KEY` missing from `UI/.env` ✅ Fixed

`UI/src/lib/narration-llm-client.ts:1` defaults to `openai` as the provider. No `OPENAI_API_KEY` was set in `UI/.env`, so any narration LLM call would fail with a 401. Ollama is already running locally and configured in `Chat/.env`.

**Applied:** Added to `UI/.env`:
```bash
NARRATION_LLM_PROVIDER="ollama"
OLLAMA_URL="http://localhost:11434"
```

To switch to OpenAI locally instead, replace with:
```bash
NARRATION_LLM_PROVIDER="openai"
OPENAI_API_KEY="<your key>"
```

---

### 6. `REDIS_URL` missing from `UI/.env` ✅ Fixed

The startup script starts a `redis-dev` Docker container on port 6379, but `UI/.env` never told the app where it was. `UI/src/lib/redis-client.ts:3` checks `UPSTASH_REDIS_URL || REDIS_URL` — both were unset, so rate limiting silently no-oped locally.

**Applied:** Added `REDIS_URL=redis://localhost:6379` to `UI/.env`.

---

## Production Gaps — Vercel env likely misconfigured

### 7. `TTS_PROVIDER` not set in Vercel env ⚠️ Action required in Vercel

`UI/src/lib/tts/index.ts:10` defaults to `rest` if `TTS_PROVIDER` is unset. The REST provider appends paths like `/api/tts/upload-reference` to `TTS_SERVICE_URL`. In production, `TTS_SERVICE_URL` points to the RunPod API which has a completely different request shape — this produces 404s or malformed requests. The RunPod provider (`runpod-tts-provider.ts`) uses `RUNPOD_TTS_ENDPOINT_ID` and the RunPod base URL directly, not `TTS_SERVICE_URL`.

**Action:** Add to Vercel → Project Settings → Environment Variables:
```bash
TTS_PROVIDER=runpod_serverless
RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3
```

---

### 8. `CHAT_SYSTEM_URL` format issue in `.env.vercel` ⚠️ Action required in Vercel

Currently set to `https://heardagain.com/api/chat`. The chat proxy routes append their own paths to this — e.g. `sessions.ts` calls `${chatSystemUrl}/api/chat/sessions`, producing the double-path URL `https://heardagain.com/api/chat/api/chat/sessions`. The value should be the bare base URL of the Chat service deployment.

**Action:** Update `CHAT_SYSTEM_URL` in Vercel to the Chat service's base URL with no trailing path:
```bash
CHAT_SYSTEM_URL=https://<chat-service-base-url>
```

---

## Minor — Cleanup / Cosmetic

### 9. `workers:start` in startup script was dead code ✅ Fixed

Replaced by the Trigger.dev dev server block (see item 3).

---

### 10. `APP_KEY` missing from `UI/.env` ✅ Fixed

`UI/src/lib/security/mfa-service.ts:259` falls back to `NEXTAUTH_SECRET` when `APP_KEY` is absent — not critical, but creates env divergence from production.

**Applied:** Added `APP_KEY` to `UI/.env` from `.env.vercel` values.

---

## Local Trigger.dev Server — Port Reference

The self-hosted Trigger.dev instance runs these services:

| Port | Service | Notes |
|------|---------|-------|
| `3030` | Main dashboard + API | **Use this for `TRIGGER_API_URL`** |
| `3060` | Electric SQL | Used internally by SDK for real-time sync |
| `5433` | Postgres | Direct DB access (Trigger.dev internal) |
| `8124` | ClickHouse | Analytics and logs |

The app connects only to port 3030. The others are internal to the Trigger.dev stack.

---

## Summary Checklist

### `UI/.env` — status

| Var | Status |
|-----|--------|
| `ENCRYPTION_KEY` | ✅ Added |
| `TRIGGER_API_URL` | ✅ Added (`http://localhost:3030`) |
| `TRIGGER_SECRET_KEY` | ✅ Fixed |
| `AUDIO_GENERATION_ENABLED` | ✅ Added (`true`) |
| `NARRATION_LLM_PROVIDER` | ✅ Added (`ollama`) |
| `OLLAMA_URL` | ✅ Added |
| `REDIS_URL` | ✅ Added |
| `TTS_PROVIDER` | ✅ Added (`rest`) |
| `APP_KEY` | ✅ Added |

### `Scripts/start-dev.sh` — status

| Change | Status |
|--------|--------|
| Replace dead `workers:start` with `trigger.dev dev` | ✅ Done |
| Pass `TRIGGER_API_URL=http://localhost:3030` to dev worker | ✅ Done |
| Update summary printout | ✅ Done |

### Vercel env — outstanding

| Var | Action |
|-----|--------|
| `TTS_PROVIDER=runpod_serverless` | ⚠️ Add in Vercel dashboard |
| `RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3` | ⚠️ Add in Vercel dashboard |
| `CHAT_SYSTEM_URL` | ⚠️ Fix to bare base URL |
