import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/invites/[token]/decline - Decline a familyspace invite
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const token = req.query.token as string

    const invite = await prisma.familyspaceInvite.findUnique({ where: { token } })

    if (!invite) throw Errors.notFound('Invite')

    if (invite.status !== 'PENDING') {
      throw Errors.badRequest(`Invite has already been ${invite.status.toLowerCase()}`)
    }

    if (invite.email !== user.email) {
      throw Errors.forbidden('This invite was sent to a different email address')
    }

    await prisma.familyspaceInvite.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    })

    return successResponse(res, { message: 'Invite declined' })
  },
})
