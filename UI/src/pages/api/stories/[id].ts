import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors, sanitizeStoryResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // GET /api/stories/[id] - Get story details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
      include: {
        subject: {
          select: { id: true, firstName: true, lastName: true, nickname: true },
        },
        speaker: {
          select: { id: true, firstName: true, lastName: true, nickname: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        voiceProfile: {
          select: { id: true, name: true },
        },
        generatedAudioAsset: {
          select: { id: true, storagePath: true, durationSeconds: true, mimeType: true },
        },
        assets: {
          include: {
            asset: {
              select: {
                id: true, filename: true, originalName: true, mimeType: true,
                assetType: true, storagePath: true, durationSeconds: true, transcript: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            replies: {
              include: {
                user: {
                  select: { id: true, displayName: true, avatarUrl: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    })

    if (!story) throw Errors.notFound('Story')

    // Sanitize response to remove storage path information
    const sanitizedStory = sanitizeStoryResponse({
      id: story.id,
      title: story.title,
      content: story.content,
      excerpt: story.excerpt,
      storyType: story.storyType,
      status: story.status,
      isPinned: story.isPinned,
      storyDate: story.storyDate,
      storyDatePrecision: story.storyDatePrecision,
      tags: story.tags,
      subject: story.subject,
      speaker: story.speaker,
      createdBy: story.createdBy,
      voiceProfile: story.voiceProfile,
      narratedContent: story.narratedContent,
      narrationStatus: story.narrationStatus,
      narrationModel: story.narrationModel,
      narrationUpdatedAt: story.narrationUpdatedAt,
      narrationApprovedAt: story.narrationApprovedAt,
      generatedAudio: story.generatedAudioAsset, // Will be sanitized
      assets: story.assets.map((sa) => ({
        id: sa.id,
        role: sa.assetRole,
        sortOrder: sa.sortOrder,
        caption: sa.caption,
        asset: sa.asset, // Will be sanitized
      })),
      comments: story.comments,
      favoriteCount: story._count.favorites,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    })

    return successResponse(res, sanitizedStory)
  },

  // PUT /api/stories/[id] - Update story
  PUT: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const existing = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!existing) throw Errors.notFound('Story')

    const {
      title, content, storyType, subjectId, speakerId, excerpt,
      storyDate, storyDatePrecision, location, tags, isPinned, status,
      regenerateNarration,
    } = req.body

    const updateData: any = {}
    const contentChanged =
      content !== undefined && content.trim() !== existing.content.trim()

    if (title !== undefined) updateData.title = title
    if (content !== undefined) {
      updateData.content = content
      if (!excerpt) updateData.excerpt = content.substring(0, 200)
    }
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (storyType !== undefined) updateData.storyType = storyType
    if (subjectId !== undefined) updateData.subjectId = subjectId || null
    if (speakerId !== undefined) updateData.speakerId = speakerId || null
    if (storyDate !== undefined) updateData.storyDate = storyDate ? new Date(storyDate) : null
    if (storyDatePrecision !== undefined) updateData.storyDatePrecision = storyDatePrecision
    if (location !== undefined) updateData.location = location || null
    if (tags !== undefined) updateData.tags = tags
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (status !== undefined && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      updateData.status = status
    }

    // Narration staleness: when content changes, an existing narration becomes out-of-date.
    const hasExistingNarration =
      !!existing.narratedContent &&
      existing.narrationStatus !== 'NONE' &&
      existing.narrationStatus !== 'FAILED'

    if (contentChanged && hasExistingNarration) {
      if (regenerateNarration === true) {
        // Caller asked to regenerate; mark PENDING and clear text.
        // The UI is expected to trigger POST /rewrite-first-person after the PUT succeeds.
        updateData.narrationStatus = 'PENDING'
        updateData.narratedContent = null
        updateData.narrationApprovedAt = null
        updateData.narrationApprovedById = null
        updateData.narrationUpdatedAt = new Date()
      } else {
        updateData.narrationStatus = 'STALE'
        updateData.narrationUpdatedAt = new Date()
      }
    }

    const story = await prisma.story.update({
      where: { id: storyId },
      data: updateData,
    })

    return successResponse(res, {
      id: story.id,
      title: story.title,
      status: story.status,
      narrationStatus: story.narrationStatus,
      narrationContentChanged: contentChanged && hasExistingNarration,
      updatedAt: story.updatedAt,
    })
  }),

  // DELETE /api/stories/[id] - Delete story
  DELETE: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const existing = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!existing) throw Errors.notFound('Story')

    await prisma.story.delete({ where: { id: storyId } })

    return successResponse(res, { deleted: true })
  }),
})
