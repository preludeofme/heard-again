# Trigger.dev v3 Narration Migration Plan

## Why This Migration

BullMQ requires a persistent Node.js process. Vercel is stateless serverless. This structural mismatch is the root of every reliability workaround currently in the narration system — the dual-layer status check, the RunPod rescue path, lock extension, stale-job cleanup. Trigger.dev v3 resolves the mismatch at the architectural level: tasks run on their infrastructure, triggered from Vercel API routes, with real-time progress streamed directly to the React frontend via SSE.

**What you gain:**
- No separate worker host to manage, monitor, or scale
- Real-time progress updates (SSE via `useRealtimeRun`) replacing 2s polling
- Built-in retry, deduplication, cancellation, and job observability
- Scales automatically with usage; no concurrency tuning

**What stays the same:**
- `VoiceGenerationJob` DB records and all business logic
- `persistAsset` / sibling pruning logic (ported verbatim)
- Consent checking, cache hit path, dedup logic
- `cloudJobId` / RunPod integration inside the task
- Audio serve endpoint (`/api/assets/serve/[id]`)
- All security checks and familyspace tenant isolation

---

## Architecture: Before vs After

```
BEFORE
──────
User → GET /api/stories/[id]/narrate
         └─ create VoiceGenerationJob (DB)
         └─ enqueueNarrationRender() → BullMQ (Redis)
              └─ [somewhere: narrationWorker.ts process]
                   └─ synthesizeBatch() → RunPod
                   └─ updateProgress() → BullMQ job
User → polls GET /api/narration-jobs/[id] every 2s
         └─ reads BullMQ job progress (phase, sentences)
         └─ rescue path: checks RunPod directly via cloudJobId
         └─ rescue path: finalizes asset inline if RunPod done

AFTER
─────
User → GET /api/stories/[id]/narrate
         └─ create VoiceGenerationJob (DB)
         └─ narrationTask.trigger() → Trigger.dev
              └─ [Trigger.dev infra runs narration-task.ts]
                   └─ synthesizeBatch() → RunPod
                   └─ metadata.set() → SSE to frontend
         └─ returns triggerRunId + publicAccessToken to frontend
User → useRealtimeRun(triggerRunId) — live SSE, no polling
         └─ run.metadata.phase, sentencesDone, sentencesTotal
         └─ run.status for terminal state
```

---

## Files Changed

| File | Action |
|------|--------|
| `UI/src/trigger/narration-task.ts` | **Create** — Trigger.dev task (replaces narrationWorker.ts) |
| `UI/trigger.config.ts` | **Create** — Trigger.dev project config |
| `UI/src/pages/api/trigger.ts` | **Create** — webhook handler for Trigger.dev |
| `UI/src/pages/api/stories/[id]/narrate.ts` | **Modify** — call `tasks.trigger()` instead of BullMQ |
| `UI/src/pages/api/narration-jobs/[id].ts` | **Modify** — read Trigger.dev run state; remove BullMQ/rescue path |
| `UI/src/components/stories/StoryNarrationPlayer.tsx` | **Modify** — `useRealtimeRun()` replaces polling loop |
| `prisma/schema.prisma` | **Modify** — add `triggerRunId` to `VoiceGenerationJob` |
| `UI/src/workers/narrationWorker.ts` | **Delete** |
| `UI/src/lib/queues/narrationQueue.ts` | **Delete** (narration parts only — `importQueue.ts` stays) |
| `UI/src/workers/start-workers.ts` | **Modify** — remove narration worker, keep import worker |

---

## Phase 1 — Trigger.dev Account + SDK Setup

### 1.1 Create account and project

1. Sign up at [trigger.dev](https://trigger.dev)
2. Create a new project — name it `heard-again`
3. Copy your **Project ID** (format: `proj_xxxxxxxxxxxxxxxx`)
4. Copy your **Secret Key** (`TRIGGER_SECRET_KEY`) from Project Settings → API Keys

### 1.2 Install SDK

```bash
cd UI
npm install @trigger.dev/sdk@latest @trigger.dev/react-hooks@latest @trigger.dev/nextjs@latest
```

### 1.3 Run the init command

```bash
cd UI
npx trigger.dev@latest init
```

When prompted:
- Select your project
- **Framework**: Next.js (Pages Router)
- **Task directory**: `src/trigger`

This creates:
- `UI/trigger.config.ts`
- `UI/src/pages/api/trigger.ts`
- `UI/src/trigger/` directory

### 1.4 Verify `trigger.config.ts`

The init command generates this — confirm it matches:

```typescript
// UI/trigger.config.ts
import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'proj_YOUR_PROJECT_ID',
  runtime: 'node',
  logLevel: 'log',
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 5_000,
      factor: 2,
    },
  },
  dirs: ['./src/trigger'],
})
```

### 1.5 Verify `src/pages/api/trigger.ts`

```typescript
// UI/src/pages/api/trigger.ts
export { handler as default, config } from '@trigger.dev/nextjs/pages'
```

---

## Phase 2 — Prisma Schema + Migration

Add `triggerRunId` to `VoiceGenerationJob` to store the Trigger.dev run ID so the status endpoint and cancel endpoint can look it up from the DB.

### 2.1 Edit `prisma/schema.prisma`

Find the `VoiceGenerationJob` model and add one field:

```prisma
model VoiceGenerationJob {
  // ... existing fields ...
  cloudJobId    String?   // RunPod job ID (unchanged)
  triggerRunId  String?   // Trigger.dev run ID (new)
  // ... rest of model ...
}
```

### 2.2 Run the migration

```bash
# From repo root
npm run db:migrate
# When prompted for a name: narration_trigger_run_id
```

### 2.3 Regenerate Prisma client

```bash
npm run db:generate
```

---

## Phase 3 — Create the Narration Task

This is a direct port of `narrationWorker.ts`'s `handleNarrationRender` function into a Trigger.dev task. The business logic is identical — only the runtime wrapper changes.

### Create `UI/src/trigger/narration-task.ts`

```typescript
import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { getTTSProvider } from '@/lib/tts'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrationTaskPayload {
  storyId: string
  familyspaceId: string
  voiceProfileId: string
  userId: string
  voiceGenerationJobId: string
}

export interface NarrationTaskProgress {
  phase: 'queued' | 'loading' | 'synthesizing' | 'saving' | 'complete' | 'failed'
  sentencesDone: number
  sentencesTotal: number
  message?: string
}

export interface NarrationTaskOutput {
  assetId: string
  audioId: string
}

// ─── Helpers (ported verbatim from narrationWorker.ts) ────────────────────────

const NARRATION_DEFAULT_MIME = 'audio/mpeg'
const NARRATION_DEFAULT_EXT = 'mp3'

function audioExtensionFor(mimeType: string): string {
  if (mimeType === 'audio/mpeg') return 'mp3'
  if (mimeType === 'audio/wav') return 'wav'
  return NARRATION_DEFAULT_EXT
}

async function fetchVoiceProfile(familyspaceId: string, voiceProfileId: string) {
  const profile = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, familyspaceId, status: 'READY' },
    select: {
      id: true,
      name: true,
      externalId: true,
      personId: true,
      sourceTranscript: true,
      sourceAsset: { select: { transcript: true } },
    },
  })
  if (!profile) {
    throw new Error(
      `Voice profile ${voiceProfileId} not found or not READY in familyspace ${familyspaceId}`
    )
  }
  return profile
}

async function fetchStory(familyspaceId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, familyspaceId },
    select: {
      id: true,
      content: true,
      narratedContent: true,
      narrationStatus: true,
      generatedAudioAssetId: true,
    },
  })
  if (!story) {
    throw new Error(`Story ${storyId} not found in familyspace ${familyspaceId}`)
  }
  return story
}

async function assertConsent(
  familyspaceId: string,
  voiceProfileId: string,
  personId: string | null
) {
  if (!personId) return
  const consent = await prisma.voiceConsent.findFirst({
    where: {
      familyspaceId,
      revokedAt: null,
      allowsGeneration: true,
      OR: [{ voiceProfileId }, { personId }],
    },
    orderBy: { recordedAt: 'desc' },
  })
  if (!consent) {
    throw new Error(
      'Voice consent is required before generating audio with this profile.'
    )
  }
}

async function persistAsset(params: {
  familyspaceId: string
  userId: string
  storyId: string
  voiceProfileId: string
  personId: string | null
  audioId: string
  audioBuffer: Buffer
  duration: number
  synthesisTime: number
  sentenceCount: number
  mimeType: string
}): Promise<string> {
  const {
    familyspaceId, userId, storyId, voiceProfileId, personId,
    audioId, audioBuffer, duration, synthesisTime, sentenceCount, mimeType,
  } = params

  const extension = audioExtensionFor(mimeType)
  const audioFilename = audioId.split('/').pop() ?? `${audioId}.${extension}`
  const libStorage = getStorageService()
  const uploadResult = await libStorage.uploadFile(audioBuffer, audioFilename, mimeType, {
    folder: `generated-audio/${familyspaceId}`,
  })
  const storageType = libStorage.getMode() === 'local' ? 'LOCAL' : 'CLOUDFLARE_R2'

  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: audioFilename,
      originalName: audioFilename,
      mimeType,
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType,
      storagePath: uploadResult.storagePath,
      assetType: 'GENERATED_AUDIO',
      processingStatus: 'COMPLETED',
      uploadedById: userId,
      durationSeconds: duration,
      metadata: {
        source: 'narration.render',
        ttsAudioId: audioId,
        voiceProfileId,
        personId,
        storyId,
        sentenceCount,
        synthesisTimeSeconds: synthesisTime,
        format: extension,
      },
    },
  })
  return asset.id
}

async function deleteAssetById(assetId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, storagePath: true, assetType: true },
  })
  if (!asset || asset.assetType !== 'GENERATED_AUDIO') return

  await prisma.asset.delete({ where: { id: assetId } }).catch((err) => {
    logger.warn('[narrationTask] asset.delete failed (non-fatal):', { assetId, err })
  })
  try {
    await getStorageService().deleteFile(asset.storagePath)
  } catch (err) {
    logger.warn('[narrationTask] storage delete failed (non-fatal):', { assetId, err })
  }
}

async function pruneSiblingAssetsForPair(params: {
  familyspaceId: string
  storyId: string
  voiceProfileId: string
  keepAssetId: string
}): Promise<number> {
  const { familyspaceId, storyId, voiceProfileId, keepAssetId } = params
  try {
    const siblings = await prisma.asset.findMany({
      where: {
        familyspaceId,
        assetType: 'GENERATED_AUDIO',
        id: { not: keepAssetId },
        AND: [
          { metadata: { path: ['storyId'], equals: storyId } },
          { metadata: { path: ['voiceProfileId'], equals: voiceProfileId } },
        ],
      },
      select: { id: true },
    })
    for (const sibling of siblings) {
      await deleteAssetById(sibling.id)
    }
    return siblings.length
  } catch (err) {
    logger.warn('[narrationTask] sibling-prune failed (non-fatal)', { storyId, voiceProfileId, err })
    return 0
  }
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export const narrationTask = task<NarrationTaskPayload, NarrationTaskOutput>({
  id: 'narration-render',
  maxDuration: 3_600, // 1 hour
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    factor: 2,
  },

  run: async (payload) => {
    const { storyId, familyspaceId, voiceProfileId, userId, voiceGenerationJobId } = payload

    const updateProgress = async (patch: Partial<NarrationTaskProgress>) => {
      const current = (await metadata.get('progress') ?? {}) as Partial<NarrationTaskProgress>
      const merged: NarrationTaskProgress = {
        phase: 'queued',
        sentencesDone: 0,
        sentencesTotal: 0,
        ...current,
        ...patch,
      }
      await metadata.set('progress', merged)
    }

    triggerLogger.info('starting narration render', { storyId, voiceProfileId })
    await updateProgress({ phase: 'loading', sentencesDone: 0, sentencesTotal: 0 })

    const [story, profile] = await Promise.all([
      fetchStory(familyspaceId, storyId),
      fetchVoiceProfile(familyspaceId, voiceProfileId),
    ])

    await assertConsent(familyspaceId, voiceProfileId, profile.personId)

    const text = (
      story.narrationStatus === 'APPROVED' && story.narratedContent
        ? story.narratedContent
        : story.content || ''
    ).trim()
    if (!text) throw new Error(`Story ${storyId} has no content to narrate`)

    await prisma.voiceGenerationJob.update({
      where: { id: voiceGenerationJobId },
      data: { status: 'PROCESSING', startedAt: new Date(), errorMessage: null },
    })

    await updateProgress({ phase: 'synthesizing' })

    if (!profile.externalId) {
      throw new Error(
        `Voice profile ${voiceProfileId} has no externalId — was it created before the RunPod migration?`
      )
    }

    const provider = getTTSProvider()
    const referenceText = profile.sourceTranscript ?? profile.sourceAsset?.transcript ?? null
    const startedAt = Date.now()

    const completeEvent = await provider.synthesizeBatch(
      profile.externalId,
      text,
      familyspaceId,
      referenceText,
      async (event) => {
        await updateProgress({
          phase: 'synthesizing',
          sentencesDone: event.sentencesDone,
          sentencesTotal: event.sentencesTotal,
          message: event.lastSentenceSeconds
            ? `Last sentence: ${event.lastSentenceSeconds.toFixed(1)}s`
            : undefined,
        })
      },
      async (cloudJobId) => {
        await prisma.voiceGenerationJob
          .update({ where: { id: voiceGenerationJobId }, data: { cloudJobId } })
          .catch(() => undefined)
      }
    )

    await updateProgress({
      phase: 'saving',
      sentencesDone: completeEvent.sentenceCount,
      sentencesTotal: completeEvent.sentenceCount,
    })

    // Check if user cancelled during synthesis — discard result if so
    const currentStatus = await prisma.voiceGenerationJob.findUnique({
      where: { id: voiceGenerationJobId },
      select: { status: true },
    })
    if (currentStatus?.status === 'CANCELLED') {
      triggerLogger.info('job cancelled during synthesis — discarding result', {
        storyId,
        voiceGenerationJobId,
      })
      return { assetId: '', audioId: completeEvent.audioId }
    }

    const audioBuffer = await provider.downloadAudio(completeEvent.audioId, familyspaceId)
    const mimeType = completeEvent.mimeType || NARRATION_DEFAULT_MIME
    const assetId = await persistAsset({
      familyspaceId,
      userId,
      storyId,
      voiceProfileId,
      personId: profile.personId,
      audioId: completeEvent.audioId,
      audioBuffer,
      duration: completeEvent.duration,
      synthesisTime: completeEvent.synthesisTime,
      sentenceCount: completeEvent.sentenceCount,
      mimeType,
    })

    await prisma.$transaction([
      prisma.story.update({
        where: { id: storyId },
        data: { generatedAudioAssetId: assetId, voiceProfileId, narrationRenderJobId: null },
      }),
      prisma.voiceGenerationJob.update({
        where: { id: voiceGenerationJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          outputAssetId: assetId,
          durationSeconds: completeEvent.duration,
          computeTimeSeconds: completeEvent.synthesisTime,
        },
      }),
    ])

    await pruneSiblingAssetsForPair({ familyspaceId, storyId, voiceProfileId, keepAssetId: assetId })

    await updateProgress({
      phase: 'complete',
      sentencesDone: completeEvent.sentenceCount,
      sentencesTotal: completeEvent.sentenceCount,
    })

    const totalSeconds = (Date.now() - startedAt) / 1000
    triggerLogger.info('narration render complete', {
      storyId,
      voiceProfileId,
      assetId,
      duration: completeEvent.duration,
      totalSeconds,
    })

    return { assetId, audioId: completeEvent.audioId }
  },

  // Mark job FAILED in DB if Trigger.dev exhausts all retries
  onFailure: async (payload, error) => {
    logger.error('[narrationTask] exhausted retries', {
      storyId: payload.storyId,
      error: error instanceof Error ? error.message : String(error),
    })
    await prisma.voiceGenerationJob
      .updateMany({
        where: {
          id: payload.voiceGenerationJobId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 1_000)
              : 'Unknown error',
        },
      })
      .catch(() => undefined)

    await prisma.story
      .updateMany({
        where: {
          id: payload.storyId,
          narrationRenderJobId: payload.voiceGenerationJobId,
        },
        data: { narrationRenderJobId: null },
      })
      .catch(() => undefined)
  },
})
```

**Note on `metadata` imports**: `metadata` from `@trigger.dev/sdk/v3` is a task-scoped context object — only callable within a running task. `metadata.set()` pushes values to Trigger.dev's SSE stream, which `useRealtimeRun()` on the frontend receives.

---

## Phase 4 — Update `narrate.ts`

Replace the BullMQ enqueue path with `narrationTask.trigger()`. The cache hit path, consent check, story fetch, and profile resolution are all unchanged.

### Key changes in `src/pages/api/stories/[id]/narrate.ts`

**Remove these imports:**
```typescript
// Remove
import {
  enqueueNarrationRender,
  getNarrationQueue,
  narrationDedupeKey,
  removeNarrationQueueJob,
} from '@/lib/queues/narrationQueue'
```

**Add these imports:**
```typescript
import { narrationTask } from '@/trigger/narration-task'
import { auth, runs } from '@trigger.dev/sdk/v3'
```

**Update the response type:**
```typescript
// Replace QueuedNarrationResponse with:
interface QueuedNarrationResponse {
  success: true
  status: 'queued'
  narrationJobId: string       // VoiceGenerationJob DB id (unchanged)
  triggerRunId: string         // Trigger.dev run ID (replaces queueJobId)
  publicAccessToken: string    // scoped SSE token for useRealtimeRun()
  voiceProfileId: string
}
```

**Replace `clearStaleQueueJobIfNeeded` with:**
```typescript
const STALE_PROCESSING_TIMEOUT_MS = 20 * 60 * 1_000

async function clearStaleJobIfNeeded(storyId: string, voiceProfileId: string): Promise<void> {
  // Find any in-progress DB job for this pair
  const staleJob = await prisma.voiceGenerationJob.findFirst({
    where: {
      storyId,
      voiceProfileId,
      status: { in: ['QUEUED', 'PROCESSING'] },
    },
    select: { id: true, status: true, startedAt: true, triggerRunId: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!staleJob) return

  const isStale =
    staleJob.status === 'PROCESSING' &&
    staleJob.startedAt !== null &&
    Date.now() - staleJob.startedAt.getTime() > STALE_PROCESSING_TIMEOUT_MS

  if (!isStale) return

  logger.warn('[narrate] cancelling stale Trigger.dev job', {
    storyId,
    voiceProfileId,
    jobId: staleJob.id,
    triggerRunId: staleJob.triggerRunId,
  })

  if (staleJob.triggerRunId) {
    await runs.cancel(staleJob.triggerRunId).catch(() => undefined)
  }

  await prisma.voiceGenerationJob
    .update({
      where: { id: staleJob.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: 'Stale job force-cleared on retry (exceeded 20 min timeout)',
      },
    })
    .catch(() => undefined)
}
```

**Replace the enqueue block** (currently lines 212–258) with:
```typescript
try {
  await clearStaleJobIfNeeded(storyId, profile.id)

  const voiceGenerationJob = await prisma.voiceGenerationJob.create({
    data: {
      voiceProfileId: profile.id,
      storyId,
      text: text.substring(0, 10_000),
      status: 'QUEUED',
      styleOverride: { requestedLanguage: 'English', source: 'narrate.enqueue' },
    },
    select: { id: true },
  })

  // Trigger the Trigger.dev task with idempotency key for dedup
  const run = await narrationTask.trigger(
    {
      storyId,
      familyspaceId: user.familyspaceId,
      voiceProfileId: profile.id,
      userId: user.id,
      voiceGenerationJobId: voiceGenerationJob.id,
    },
    {
      idempotencyKey: `narration:render:${storyId}:${profile.id}`,
      tags: [`story:${storyId}`, `family:${user.familyspaceId}`],
    }
  )

  // Persist the run ID so status/cancel endpoints can reference it
  await prisma.voiceGenerationJob.update({
    where: { id: voiceGenerationJob.id },
    data: { triggerRunId: run.id },
  })

  await prisma.story.update({
    where: { id: storyId },
    data: { narrationRenderJobId: voiceGenerationJob.id },
  })

  // Scoped public token — safe to send to the browser (read-only, expires in 2h)
  const publicAccessToken = await auth.createPublicToken({
    scopes: { read: { runs: [run.id] } },
    expirationTime: '2h',
  })

  const payload: QueuedNarrationResponse = {
    success: true,
    status: 'queued',
    narrationJobId: voiceGenerationJob.id,
    triggerRunId: run.id,
    publicAccessToken,
    voiceProfileId: profile.id,
  }
  return res.status(202).json(payload)
} catch (error) {
  logger.error('[narrate] failed to trigger render', { storyId, error })
  return res.status(503).json({ success: false, error: 'Failed to queue narration render' })
}
```

**Note on idempotency with Trigger.dev**: If `narrationTask.trigger()` is called with the same `idempotencyKey` while a run is still active, Trigger.dev returns the existing run without creating a duplicate. If the existing run is complete or failed, a new run is created. This replaces the BullMQ dedup logic.

**Note on the dedup case**: The old code handled the dedup case by deleting the newly-created `VoiceGenerationJob` and returning the existing one's ID. With Trigger.dev's idempotency, you need to detect the dedup case and handle it. Check `run.isCached` (Trigger.dev returns a flag indicating reuse):

```typescript
if (run.isCached) {
  // A run was already in-flight — delete our new DB job and return the existing one
  await prisma.voiceGenerationJob.delete({ where: { id: voiceGenerationJob.id } }).catch(() => undefined)
  
  // Find the existing VoiceGenerationJob that has this triggerRunId
  const existingJob = await prisma.voiceGenerationJob.findFirst({
    where: { triggerRunId: run.id },
    select: { id: true },
  })
  
  // Re-issue a fresh public token for the existing run
  const publicAccessToken = await auth.createPublicToken({
    scopes: { read: { runs: [run.id] } },
    expirationTime: '2h',
  })
  
  return res.status(202).json({
    success: true,
    status: 'queued',
    narrationJobId: existingJob?.id ?? voiceGenerationJob.id,
    triggerRunId: run.id,
    publicAccessToken,
    voiceProfileId: profile.id,
  } satisfies QueuedNarrationResponse)
}
```

---

## Phase 5 — Simplify `narration-jobs/[id].ts`

The status endpoint becomes much simpler. BullMQ progress overlay and the rescue path are removed. The rescue path's job is now handled inside the task itself (the task already has `cloudJobId`, marks the DB, and sets metadata). The endpoint reads Trigger.dev run state for live jobs and DB state for terminal ones.

### Full replacement for the GET handler

**Remove these imports:**
```typescript
// Remove
import { getNarrationQueue, narrationDedupeKey, removeNarrationQueueJob } from '@/lib/queues/narrationQueue'
import { RunPodTTSProvider } from '@/lib/tts/runpod-tts-provider'
import type { SynthesisCompleteEvent } from '@/lib/tts/tts-provider.types'
```

**Add:**
```typescript
import { runs } from '@trigger.dev/sdk/v3'
import type { NarrationTaskProgress } from '@/trigger/narration-task'
```

**Remove `finalizeRunPodJob` entirely** — it is no longer needed. The task handles finalization.

**New `mapStatus` function:**
```typescript
function mapStatus(
  dbStatus: string,
  triggerStatus: string | undefined,
  phase: NarrationTaskProgress['phase'] | undefined
): NarrationJobStatusResponse['status'] {
  if (dbStatus === 'COMPLETED') return 'completed'
  if (dbStatus === 'FAILED' || dbStatus === 'CANCELLED') return 'failed'
  if (triggerStatus === 'FAILED' || triggerStatus === 'CRASHED') return 'failed'
  if (phase === 'synthesizing') return 'synthesizing'
  if (phase === 'saving') return 'saving'
  if (dbStatus === 'QUEUED') return 'queued'
  return 'processing'
}
```

**New GET handler body** (after auth check):
```typescript
const dbJob = await prisma.voiceGenerationJob.findFirst({
  where: { id: jobId, story: { familyspaceId: user.familyspaceId } },
  select: {
    id: true,
    storyId: true,
    status: true,
    startedAt: true,
    completedAt: true,
    errorMessage: true,
    outputAssetId: true,
    durationSeconds: true,
    voiceProfileId: true,
    triggerRunId: true,  // new field
  },
})

if (!dbJob) {
  return res.status(404).json({ success: false, error: 'Narration job not found' })
}

let phase: NarrationTaskProgress['phase'] | undefined
let sentencesDone = 0
let sentencesTotal = 0
let triggerStatus: string | undefined

const isTerminal =
  dbJob.status === 'COMPLETED' || dbJob.status === 'FAILED' || dbJob.status === 'CANCELLED'

if (!isTerminal && dbJob.triggerRunId) {
  try {
    const run = await runs.retrieve(dbJob.triggerRunId)
    triggerStatus = run.status

    const progress = run.metadata?.progress as NarrationTaskProgress | undefined
    if (progress) {
      phase = progress.phase
      sentencesDone = progress.sentencesDone ?? 0
      sentencesTotal = progress.sentencesTotal ?? 0
    }
  } catch (err) {
    logger.warn('[narration-jobs] Trigger.dev run retrieve failed (non-fatal)', { jobId, err })
  }
}

const status = mapStatus(dbJob.status, triggerStatus, phase)
const response: NarrationJobStatusResponse = {
  success: true,
  jobId: dbJob.id,
  storyId: dbJob.storyId,
  status,
  sentencesDone,
  sentencesTotal,
  assetId: dbJob.outputAssetId,
  assetDownloadUrl: dbJob.outputAssetId ? `/api/assets/serve/${dbJob.outputAssetId}` : null,
  errorMessage: dbJob.errorMessage,
  startedAt: dbJob.startedAt?.toISOString() ?? null,
  completedAt: dbJob.completedAt?.toISOString() ?? null,
  durationSeconds: dbJob.durationSeconds,
}

res.setHeader('Cache-Control', 'no-store')
return res.status(200).json(response)
```

### Cancel handler update

Replace the BullMQ removal in `handleCancel`:
```typescript
// Remove:
if (dbJob.storyId && dbJob.voiceProfileId) {
  await removeNarrationQueueJob(dbJob.storyId, dbJob.voiceProfileId).catch(...)
}

// Replace with:
const freshJob = await prisma.voiceGenerationJob.findUnique({
  where: { id: jobId },
  select: { triggerRunId: true },
})
if (freshJob?.triggerRunId) {
  await runs.cancel(freshJob.triggerRunId).catch((err) => {
    logger.warn('[narration-jobs] Trigger.dev cancel failed (non-fatal)', { jobId, err })
  })
}
```

---

## Phase 6 — Update `StoryNarrationPlayer.tsx`

Replace the 2-second polling loop with `useRealtimeRun()`. The state machine (`idle | checking | rendering | ready | error`) and all UI logic stay the same — only the data source changes.

### Install the hook

Already installed in Phase 1 (`@trigger.dev/react-hooks`).

### Changes to state

Add two new state fields to track Trigger.dev connection:

```typescript
// Add alongside existing state
const [triggerRunId, setTriggerRunId] = useState<string | null>(null)
const [publicAccessToken, setPublicAccessToken] = useState<string | null>(null)
```

### Add the real-time hook

```typescript
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import type { NarrationTaskProgress } from '@/trigger/narration-task'

// Inside the component, after state declarations:
const { run: liveRun } = useRealtimeRun(triggerRunId ?? '', {
  accessToken: publicAccessToken ?? '',
  enabled: !!triggerRunId && !!publicAccessToken && state === 'rendering',
})
```

### Derive progress from `liveRun`

Replace wherever `jobStatus.sentencesDone` / `jobStatus.sentencesTotal` / `jobStatus.status` are read for rendering:

```typescript
const liveProgress = liveRun?.metadata?.progress as NarrationTaskProgress | undefined

// Use these instead of polling-derived values:
const currentPhase = liveProgress?.phase ?? 'queued'
const sentencesDone = liveProgress?.sentencesDone ?? 0
const sentencesTotal = liveProgress?.sentencesTotal ?? 0
```

### Handle Trigger.dev run completion

Add a `useEffect` that watches `liveRun` for terminal state:

```typescript
useEffect(() => {
  if (!liveRun) return

  if (liveRun.status === 'COMPLETED') {
    // Task finished — re-fetch job from DB to get assetId
    void refetchJobStatus()
  }

  if (liveRun.status === 'FAILED' || liveRun.status === 'CRASHED') {
    setState('error')
    setTriggerRunId(null)
    setPublicAccessToken(null)
  }
}, [liveRun?.status])

// Helper: single DB fetch to get assetId once Trigger.dev reports COMPLETED
async function refetchJobStatus() {
  if (!jobId) return
  try {
    const res = await fetch(`/api/narration-jobs/${jobId}`)
    const data = await res.json()
    if (data.status === 'completed' && data.assetId) {
      setReadyNarration({ assetId: data.assetId, downloadUrl: data.assetDownloadUrl })
      setState('ready')
      setTriggerRunId(null)
      setPublicAccessToken(null)
    }
  } catch {
    setState('error')
  }
}
```

### Update `startNarration`

Store `triggerRunId` and `publicAccessToken` from the narrate response:

```typescript
async function startNarration() {
  // ... existing cache check logic ...

  const res = await fetch(`/api/stories/${storyId}/narrate?voiceProfileId=${selectedProfileId}`, {
    headers: { Accept: 'application/json' },
  })
  const data = await res.json()

  if (data.status === 'ready') {
    setReadyNarration({ assetId: data.assetId, downloadUrl: data.assetDownloadUrl })
    setState('ready')
    return
  }

  if (data.status === 'queued') {
    setJobId(data.narrationJobId)
    setTriggerRunId(data.triggerRunId)        // new
    setPublicAccessToken(data.publicAccessToken)  // new
    setState('rendering')
    // No polling interval needed — useRealtimeRun takes over
    return
  }

  setState('error')
}
```

### Remove the polling interval

Delete the `useEffect` that sets up `setInterval` for polling `/api/narration-jobs/{jobId}`. The `useRealtimeRun` hook replaces it entirely.

Keep a single one-time fetch on mount to check if a job is already in progress (for page reload recovery):

```typescript
useEffect(() => {
  void checkExistingJobOnMount()
}, [])

async function checkExistingJobOnMount() {
  // Call /narrate with Accept: application/json
  // If status === 'ready', populate readyNarration
  // If status === 'queued', restore triggerRunId + publicAccessToken from response
  //   → NOTE: the response includes a fresh publicAccessToken on every call
}
```

---

## Phase 7 — Environment Variables

### Add to Vercel (and `.env.local`)

```bash
TRIGGER_SECRET_KEY=tr_prod_xxxxxxxxxxxxxxxxxxxx   # from Trigger.dev dashboard
```

The Trigger.dev CLI also needs:
```bash
TRIGGER_PROJECT_ID=proj_xxxxxxxxxxxxxxxxxxxx       # only needed locally for dev
```

### Remove from Vercel (after cutover)

```bash
NARRATION_WORKER_ENABLED   # no longer used
NARRATION_WORKER_CONCURRENCY  # no longer used
```

Redis (`UPSTASH_REDIS_URL`) stays — it is still used by the import queue and rate limiting.

### Local development

```bash
cd UI
npx trigger.dev@latest dev
```

This runs a local Trigger.dev dev server that proxies to your local Next.js instance. Tasks run locally, with full hot-reload.

---

## Phase 8 — Remove BullMQ Artifacts

Do this **after** the new flow is deployed and verified in production.

### Files to delete

```
UI/src/workers/narrationWorker.ts
UI/src/lib/queues/narrationQueue.ts       # only if no other queue uses it
                                           # importQueue.ts has its own file — see below
```

### Files to modify

**`UI/src/workers/start-workers.ts`** — remove narration worker, keep import worker:

```typescript
// Remove:
import { startNarrationWorker, stopNarrationWorker } from './narrationWorker'

// Remove narrationWorker start/stop calls

// Keep:
import { startImportWorker } from '@/lib/queues/importQueue'
// ... import worker startup unchanged
```

**`UI/package.json`** — consider removing:
```json
"bullmq": "...",
"ioredis": "..."
```
Only remove if `importQueue.ts` is migrated or removed. If the import worker still runs (it does — see below), keep these.

---

## Phase 9 — Testing Checklist

### Unit tests

- [ ] `narration-task.ts` — port existing `narrationWorker` tests, replacing `job.updateProgress` assertions with `metadata.set` assertions
- [ ] `narrate.ts` — mock `narrationTask.trigger()` and `auth.createPublicToken()`; assert `triggerRunId` + `publicAccessToken` in response
- [ ] `narration-jobs/[id].ts` — mock `runs.retrieve()`; assert status mapping; assert cancel calls `runs.cancel()`

### Integration / manual checklist

- [ ] Fresh narration: click Prepare & Play → see phase progression in real-time (no 2s delay)
- [ ] Cache hit: second click returns `status: 'ready'` immediately without triggering a new run
- [ ] Voice profile switch: selecting a different profile triggers a new render
- [ ] Cancel mid-render: DELETE /api/narration-jobs/[id] → task sees CANCELLED in DB and discards result
- [ ] Dedup: two rapid clicks with same profile → only one Trigger.dev run created
- [ ] Page reload mid-render: refreshing the page restores the in-progress state and reconnects SSE
- [ ] Failure case: RunPod error → `onFailure` hook marks DB FAILED → UI shows error state
- [ ] Consent blocked: profile with person and no consent → 403 returned before triggering task
- [ ] Audio plays after completion: `/api/assets/serve/[id]` proxies correctly

### Trigger.dev dashboard checks

- [ ] Runs appear in the Trigger.dev dashboard with correct tags (`story:xxx`, `family:xxx`)
- [ ] Metadata updates visible in the run detail view
- [ ] Retry behaves correctly on simulated failure

---

## Phase 10 — Deployment Order

1. Deploy Prisma migration to production (`triggerRunId` field)
2. Deploy updated API routes (`narrate.ts`, `narration-jobs/[id].ts`) with `TRIGGER_SECRET_KEY` set on Vercel
3. Deploy updated frontend (`StoryNarrationPlayer.tsx`)
4. Verify in production with a test narration
5. **Leave old worker code in place for 48h** — any in-flight BullMQ jobs from before the cutover need to complete. The rescue path in the old `narration-jobs/[id].ts` still works for those.
6. After 48h: remove BullMQ artifacts, deploy again

---

## Out of Scope — Import Queue

`importQueue.ts` and the import worker in `start-workers.ts` are also BullMQ. They are not migrated here because they drive document ingestion for RAG (Chat service concern) and have different characteristics. The same Trigger.dev pattern applies when ready.

In the interim: the import worker needs a persistent process. Options:
- Deploy `start-workers.ts` (import-only after narration removal) to Railway
- OR migrate the import queue to Trigger.dev separately following this same pattern

---

## Rollback Plan

If production issues emerge after cutover:

1. Revert `narrate.ts` to the BullMQ version (git revert that file)
2. Revert `narration-jobs/[id].ts` to the BullMQ version
3. Revert `StoryNarrationPlayer.tsx` to polling version
4. Redeploy to Vercel
5. Spin up a Railway worker running the old `start-workers.ts` as a bridge

The Prisma `triggerRunId` column is additive and nullable — no rollback needed for the schema change.
