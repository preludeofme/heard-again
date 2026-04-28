import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // DELETE /api/comments/[id] - Delete a comment
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const commentId = req.query.id as string

    const comment = await prisma.storyComment.findUnique({
      where: { id: commentId },
      include: {
        story: { select: { familyspaceId: true } },
      },
    })

    if (!comment) throw Errors.notFound('Comment')
    if (comment.story.familyspaceId !== user.familyspaceId) throw Errors.notFound('Comment')

    // User can delete their own comments, or ADMINs can delete any
    if (comment.userId !== user.id) {
      await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')
    }

    // Delete replies first, then the comment
    await prisma.storyComment.deleteMany({ where: { parentId: commentId } })
    await prisma.storyComment.delete({ where: { id: commentId } })

    return successResponse(res, { deleted: true })
  },
})
