import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { logger } from '@/lib/logger'

export const config = {
  api: {
    responseLimit: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
    return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
  }

  const serviceToken = process.env.TTS_SERVICE_TOKEN
  if (!serviceToken) {
    logger.error('[narrate] TTS_SERVICE_TOKEN not configured')
    return res.status(503).json({ success: false, error: 'TTS service is not configured' })
  }

  let user
  try {
    user = await getAuthUserWithWorkspace(req, res)
  } catch {
    return
  }

  const storyId = req.query.id as string
  const voiceProfileIdParam = req.query.voiceProfileId as string | undefined
  const languageParam = (req.query.language as string | undefined) || 'English'

  const story = await prisma.story.findFirst({
    where: { id: storyId, workspaceId: user.workspaceId },
    select: {
      id: true,
      content: true,
      narratedContent: true,
      narrationStatus: true,
      voiceProfileId: true,
      subjectId: true,
    },
  })
  if (!story) {
    return res.status(404).json({ success: false, error: 'Story not found' })
  }

  // Pick narration source text: approved narration > original content.
  const text =
    story.narrationStatus === 'APPROVED' && story.narratedContent
      ? story.narratedContent
      : story.content
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Story has no text to narrate' })
  }

  // Resolve voice profile.
  let profileId = voiceProfileIdParam || story.voiceProfileId || null
  if (!profileId && story.subjectId) {
    const defaultProfile = await prisma.voiceProfile.findFirst({
      where: {
        workspaceId: user.workspaceId,
        personId: story.subjectId,
        isDefault: true,
        status: 'READY',
      },
      select: { id: true },
    })
    profileId = defaultProfile?.id ?? null
  }
  if (!profileId) {
    return res
      .status(400)
      .json({ success: false, error: 'No voice profile specified or available for this story' })
  }

  const profile = await prisma.voiceProfile.findFirst({
    where: { id: profileId, workspaceId: user.workspaceId, status: 'READY' },
    select: { id: true, name: true, personId: true },
  })
  if (!profile) {
    return res
      .status(404)
      .json({ success: false, error: 'Voice profile not found or not ready' })
  }

  // Voice consent check.
  if (profile.personId) {
    const consent = await prisma.voiceConsent.findFirst({
      where: {
        workspaceId: user.workspaceId,
        revokedAt: null,
        allowsGeneration: true,
        OR: [{ voiceProfileId: profile.id }, { personId: profile.personId }],
      },
      orderBy: { recordedAt: 'desc' },
    })
    if (!consent) {
      return res.status(403).json({
        success: false,
        error: 'Voice generation is blocked until explicit consent is recorded',
      })
    }
  }

  // Audit row — no outputAssetId since we stream.
  const job = await prisma.voiceGenerationJob.create({
    data: {
      voiceProfileId: profile.id,
      storyId,
      text: text.substring(0, 10000),
      status: 'PROCESSING',
      startedAt: new Date(),
      styleOverride: { language: languageParam, streamed: true },
    },
    select: { id: true },
  })

  const startedAt = Date.now()
  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(`${TTS_SERVICE_URL}/api/tts/synthesize-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
        'X-Workspace-Id': user.workspaceId,
      },
      body: JSON.stringify({
        profileId: profile.name,
        text,
        language: languageParam,
        workspaceId: user.workspaceId,
      }),
    })
  } catch (error) {
    logger.error('[narrate] TTS fetch failed', { storyId, error })
    await prisma.voiceGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'TTS unreachable',
      },
    })
    return res.status(502).json({ success: false, error: 'TTS service unreachable' })
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const errText = await upstreamResponse.text().catch(() => '')
    logger.error('[narrate] TTS returned error', {
      storyId,
      status: upstreamResponse.status,
      body: errText.slice(0, 500),
    })
    await prisma.voiceGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: `TTS ${upstreamResponse.status}: ${errText.slice(0, 500)}`,
      },
    })
    return res
      .status(502)
      .json({ success: false, error: 'TTS synthesis failed' })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-AI-Generated', 'true')
  res.setHeader('X-Narration-Source', story.narrationStatus === 'APPROVED' ? 'approved' : 'original')
  res.setHeader('X-Voice-Profile-Id', profile.id)
  res.setHeader('X-Narration-Job-Id', job.id)

  const nodeStream = Readable.fromWeb(upstreamResponse.body as any)

  let bytesStreamed = 0
  nodeStream.on('data', (chunk: Buffer) => {
    bytesStreamed += chunk.length
  })

  nodeStream.on('error', async (error) => {
    logger.error('[narrate] stream error', { storyId, jobId: job.id, error })
    try {
      await prisma.voiceGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'stream error',
        },
      })
    } catch {
      /* noop */
    }
  })

  nodeStream.on('end', async () => {
    const elapsedSec = (Date.now() - startedAt) / 1000
    try {
      await prisma.voiceGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          computeTimeSeconds: elapsedSec,
          styleOverride: {
            language: languageParam,
            streamed: true,
            bytesStreamed,
            source: story.narrationStatus === 'APPROVED' ? 'approved' : 'original',
          },
        },
      })
    } catch (error) {
      logger.error('[narrate] failed to mark job completed', { jobId: job.id, error })
    }
  })

  nodeStream.pipe(res)
}
