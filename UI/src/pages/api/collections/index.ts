import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // GET /api/collections - List collections in familyspace
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)

    const collections = await prisma.collection.findMany({
      where: { familyspaceId: user.familyspaceId },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
        _count: {
          select: { stories: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })

    const result = collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isPinned: c.isPinned,
      storyCount: c._count.stories,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    }))

    return successResponse(res, result)
  },

  // POST /api/collections - Create a collection
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      name: [rules.required, rules.minLength(1), rules.maxLength(200)],
    })
    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const { name, description } = req.body

    const collection = await prisma.collection.create({
      data: {
        familyspaceId: user.familyspaceId,
        createdById: user.id,
        name,
        description: description || null,
      },
    })

    return successResponse(res, {
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
    }, 201)
  },
})
