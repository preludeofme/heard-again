import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/collections/[id] - Get collection with stories
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const collectionId = req.query.id as string

    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, familyspaceId: user.familyspaceId },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
        stories: {
          include: {
            story: {
              select: {
                id: true, title: true, excerpt: true, storyType: true, status: true,
                tags: true, createdAt: true,
                subject: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            addedBy: { select: { id: true, displayName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!collection) throw Errors.notFound('Collection')

    return successResponse(res, {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPinned: collection.isPinned,
      createdBy: collection.createdBy,
      stories: collection.stories.map((cs) => ({
        id: cs.id,
        sortOrder: cs.sortOrder,
        addedAt: cs.addedAt,
        addedBy: cs.addedBy,
        story: cs.story,
      })),
      createdAt: collection.createdAt,
    })
  },

  // PUT /api/collections/[id] - Update collection
  PUT: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const collectionId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, familyspaceId: user.familyspaceId },
    })
    if (!existing) throw Errors.notFound('Collection')

    const { name, description, isPinned } = req.body
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isPinned !== undefined) updateData.isPinned = isPinned

    const collection = await prisma.collection.update({
      where: { id: collectionId },
      data: updateData,
    })

    return successResponse(res, {
      id: collection.id,
      name: collection.name,
      updatedAt: collection.updatedAt,
    })
  },

  // DELETE /api/collections/[id] - Delete collection
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const collectionId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, familyspaceId: user.familyspaceId },
    })
    if (!existing) throw Errors.notFound('Collection')

    await prisma.collection.delete({ where: { id: collectionId } })

    return successResponse(res, { deleted: true })
  },
})
