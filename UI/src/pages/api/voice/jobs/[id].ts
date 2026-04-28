import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const jobId = req.query.id as string

    const job = await prisma.voiceGenerationJob.findFirst({
      where: {
        id: jobId,
        voiceProfile: {
          familyspaceId: user.familyspaceId,
        },
      },
      select: {
        id: true,
        status: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        outputAssetId: true,
      },
    })

    if (!job) {
      return res.status(404).json({ success: false, error: 'Voice generation job not found' })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        outputAssetId: job.outputAssetId,
        outputAssetDownloadUrl: job.outputAssetId ? `/api/assets/${job.outputAssetId}/download` : null,
      },
    })
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to load voice generation job',
    })
  }
}
