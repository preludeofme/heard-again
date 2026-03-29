import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'

const REQUIRED_CONFIRMATION = 'DELETE MY ACCOUNT'

function buildRedactedEmail(userId: string): string {
  const suffix = userId.replace(/-/g, '').slice(0, 12)
  return `deleted+${suffix}@redacted.heard-again.local`
}

export default apiHandler({
  // POST /api/privacy/permanent-deletion - GDPR-style permanent self-data deletion
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const { confirmationText } = req.body || {}

    if (typeof confirmationText !== 'string' || confirmationText.trim() !== REQUIRED_CONFIRMATION) {
      throw Errors.badRequest(`confirmationText must exactly match "${REQUIRED_CONFIRMATION}"`)
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      throw Errors.notFound('User')
    }

    if (existing.status === 'DELETED') {
      return successResponse(res, {
        deleted: true,
        alreadyDeleted: true,
      })
    }

    const redactedEmail = buildRedactedEmail(user.id)

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM sessions WHERE user_id = ${user.id}`
      await tx.$executeRaw`DELETE FROM accounts WHERE user_id = ${user.id}`

      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          email: redactedEmail,
          password: null,
          oauthProvider: null,
          oauthId: null,
          displayName: null,
          avatarUrl: null,
          defaultWorkspaceId: null,
        },
      })
    })

    return successResponse(res, {
      deleted: true,
      deletedAt: new Date().toISOString(),
      redactedEmail,
      note: 'Account credentials and personally identifiable profile fields have been permanently erased.',
    })
  },
})
