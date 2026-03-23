import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/stories - List stories (with filters)
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const { search, status, subjectId, speakerId, type, page = '1', limit = '20' } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20))
    const skip = (pageNum - 1) * pageSize

    const where: any = {
      workspaceId: user.workspaceId,
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status && typeof status === 'string') where.status = status.toUpperCase()
    if (subjectId && typeof subjectId === 'string') where.subjectId = subjectId
    if (speakerId && typeof speakerId === 'string') where.speakerId = speakerId
    if (type && typeof type === 'string') where.storyType = type.toUpperCase()

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        include: {
          subject: {
            select: { id: true, firstName: true, lastName: true },
          },
          speaker: {
            select: { id: true, firstName: true, lastName: true },
          },
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
          _count: {
            select: { comments: true, assets: true, favorites: true },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.story.count({ where }),
    ])

    const result = stories.map((s) => ({
      id: s.id,
      title: s.title,
      excerpt: s.excerpt || s.content.substring(0, 200),
      storyType: s.storyType,
      status: s.status,
      isPinned: s.isPinned,
      storyDate: s.storyDate,
      storyDatePrecision: s.storyDatePrecision,
      tags: s.tags,
      subject: s.subject,
      speaker: s.speaker,
      createdBy: s.createdBy,
      hasAudio: !!s.generatedAudioAssetId,
      counts: s._count,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))

    return successResponse(res, {
      stories: result,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },

  // POST /api/stories - Create a story
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      title: [rules.required, rules.minLength(1), rules.maxLength(500)],
      content: [rules.required, rules.minLength(1)],
    })

    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const {
      title, content, storyType, subjectId, speakerId, excerpt,
      storyDate, storyDatePrecision, tags, status,
    } = req.body

    // Verify subject/speaker belong to workspace if provided
    if (subjectId) {
      const subject = await prisma.person.findFirst({
        where: { id: subjectId, workspaceId: user.workspaceId },
      })
      if (!subject) throw Errors.notFound('Subject person')
    }
    if (speakerId) {
      const speaker = await prisma.person.findFirst({
        where: { id: speakerId, workspaceId: user.workspaceId },
      })
      if (!speaker) throw Errors.notFound('Speaker person')
    }

    const story = await prisma.story.create({
      data: {
        workspaceId: user.workspaceId,
        createdById: user.id,
        title,
        content,
        storyType: storyType || 'MEMORY',
        subjectId: subjectId || null,
        speakerId: speakerId || null,
        excerpt: excerpt || content.substring(0, 200),
        storyDate: storyDate ? new Date(storyDate) : null,
        storyDatePrecision: storyDatePrecision || 'EXACT',
        tags: tags || [],
        status: status || 'DRAFT',
      },
    })

    return successResponse(res, {
      id: story.id,
      title: story.title,
      status: story.status,
      createdAt: story.createdAt,
    }, 201)
  },
})
