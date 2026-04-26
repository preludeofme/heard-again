import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const CHAT_SERVICE_URL =
  process.env.CHAT_SERVICE_URL || process.env.CHAT_SYSTEM_URL || 'https://localhost:4778'

// For local development with self-signed certificates
if (CHAT_SERVICE_URL.includes('localhost') || CHAT_SERVICE_URL.includes('127.0.0.1')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

export default apiHandler({
  POST: async (req, res) => {
    if (process.env.NARRATION_REWRITE_ENABLED === 'false') {
      return res
        .status(503)
        .json({ success: false, error: 'Narration rewrite is not enabled' })
    }

    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
      include: {
        subject: { select: { firstName: true, lastName: true, nickname: true } },
        speaker: { select: { firstName: true, lastName: true, nickname: true } },
      },
    })
    if (!story) throw Errors.notFound('Story')

    if (!story.content || story.content.trim().length === 0) {
      throw Errors.badRequest('Story has no content to rewrite')
    }

    const secret = process.env.CHAT_SERVICE_SECRET
    if (!secret) {
      logger.error('[narration] CHAT_SERVICE_SECRET not configured')
      return res
        .status(503)
        .json({ success: false, error: 'Rewrite service is not configured' })
    }

    await prisma.story.update({
      where: { id: storyId },
      data: {
        narrationStatus: 'PENDING',
        narrationUpdatedAt: new Date(),
      },
    })

    const subjectName = formatPersonName(story.subject)
    const speakerName = formatPersonName(story.speaker)

    try {
      logger.info('[narration] calling rewrite service', { url: `${CHAT_SERVICE_URL}/api/rewrite/first-person`, storyId })
      
      const response = await fetch(`${CHAT_SERVICE_URL}/api/rewrite/first-person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
          'x-workspace-id': user.workspaceId,
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          content: story.content,
          subjectName,
          speakerName,
        }),
      })

      const payload = await response.json().catch((e) => {
        logger.error('[narration] failed to parse rewrite response', { error: e.message, storyId })
        return null
      })
      
      if (!response.ok || !payload?.success) {
        const message = payload?.error || `Rewrite failed (${response.status})`
        logger.error('[narration] rewrite service returned error', { status: response.status, payload, storyId })
        await prisma.story.update({
          where: { id: storyId },
          data: { narrationStatus: 'FAILED', narrationUpdatedAt: new Date() },
        })
        throw Errors.badRequest(message)
      }

      const { rewrittenContent, model } = payload.data as {
        rewrittenContent: string
        model: string
      }

      const cleaned = typeof rewrittenContent === 'string' ? rewrittenContent.trim() : ''
      if (cleaned.length === 0) {
        logger.error('[narration] rewrite returned empty content', { storyId, model })
        await prisma.story.update({
          where: { id: storyId },
          data: { narrationStatus: 'FAILED', narrationModel: model, narrationUpdatedAt: new Date() },
        })
        throw Errors.badRequest('Rewrite model returned empty content — try again or switch models')
      }

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: {
          narratedContent: cleaned,
          narrationStatus: 'READY',
          narrationModel: model,
          narrationUpdatedAt: new Date(),
          narrationApprovedAt: null,
          narrationApprovedById: null,
        },
        select: {
          id: true,
          narratedContent: true,
          narrationStatus: true,
          narrationModel: true,
          narrationUpdatedAt: true,
        },
      })

      return successResponse(res, updated)
    } catch (error) {
      if ((error as any)?.statusCode) throw error
      // Log the full error to help debug connection/SSL issues
      logger.error('[narration] rewrite error', { 
        storyId, 
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        code: (error as any)?.code
      })
      
      await prisma.story.update({
        where: { id: storyId },
        data: { narrationStatus: 'FAILED', narrationUpdatedAt: new Date() },
      })
      return res
        .status(502)
        .json({ success: false, error: 'Rewrite service unavailable' })
    }
  },
})

function formatPersonName(
  person?: { firstName: string; lastName: string | null; nickname: string | null } | null
): string | undefined {
  if (!person) return undefined
  if (person.nickname) return person.nickname
  return `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`
}
