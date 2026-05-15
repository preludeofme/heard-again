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

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, familyspaceId: user.familyspaceId },
      select: { triggerRunId: true, status: true },
    })

    if (!job) throw Errors.notFound('ImportJob')

    if (!job.triggerRunId) {
      return successResponse(res, { token: null, runId: null })
    }

    const token = await auth.createPublicToken({
      scopes: { read: { runs: [job.triggerRunId] } },
      expirationTime: '2h',
    })

    return successResponse(res, { token, runId: job.triggerRunId })
  },
})
