import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const existing = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!existing) throw Errors.notFound('Story')

    const story = await prisma.story.update({
      where: { id: storyId },
      data: { status: 'ARCHIVED' },
    })

    return successResponse(res, { id: story.id, status: story.status })
  },
})
