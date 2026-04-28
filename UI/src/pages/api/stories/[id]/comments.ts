import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/stories/[id]/comments - List story comments
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string

    const story = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const comments = await prisma.storyComment.findMany({
      where: { storyId, parentId: null },
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
    })

    return successResponse(res, comments)
  },

  // POST /api/stories/[id]/comments - Add a comment
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const { valid, errors } = validate(req.body, {
      content: [rules.required, rules.minLength(1), rules.maxLength(5000)],
    })
    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const story = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const { content, parentId } = req.body

    // Verify parent comment exists if threaded
    if (parentId) {
      const parent = await prisma.storyComment.findFirst({
        where: { id: parentId, storyId },
      })
      if (!parent) throw Errors.notFound('Parent comment')
    }

    const comment = await prisma.storyComment.create({
      data: {
        storyId,
        familyspaceId: user.familyspaceId,
        userId: user.id,
        content,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    })

    return successResponse(res, comment, 201)
  },
})
