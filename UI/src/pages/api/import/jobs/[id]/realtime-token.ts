import { auth } from '@trigger.dev/sdk/v3'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  GET: async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const jobId = req.query.id as string

    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { triggerRunId: true, status: true, importedById: true, familyspaceId: true },
    })

    if (!job) throw Errors.notFound('ImportJob')

    const isImporter = job.importedById === user.id
    let hasAccess = isImporter

    if (!hasAccess) {
      const membership = await prisma.membership.findUnique({
        where: {
          familyspaceId_userId: {
            familyspaceId: job.familyspaceId,
            userId: user.id,
          },
        },
      })
      hasAccess = !!(membership && membership.status === 'ACTIVE')
    }

    if (!hasAccess) {
      throw Errors.notFound('ImportJob')
    }

    if (!job.triggerRunId) {
      return successResponse(res, { token: null, runId: null })
    }

    const token = await auth.createPublicToken({
      scopes: { read: { runs: [job.triggerRunId] } },
      expirationTime: '2h',
    })

    const triggerApiUrl = process.env.TRIGGER_API_URL ?? 'https://api.trigger.dev'
    return successResponse(res, { token, runId: job.triggerRunId, triggerApiUrl })
  },
})
