import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const existing = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
    })
    if (!existing) throw Errors.notFound('Story')

    const story = await prisma.story.update({
      where: { id: storyId },
      data: { status: 'PUBLISHED' },
    })

    return successResponse(res, { id: story.id, status: story.status })
  },
})
