import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { RunPodTTSProvider } from '@/lib/tts/runpod-tts-provider'

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getAuthUserWithFamilyspace(req, res)
  const { assetId, runpodJobId } = req.query

  if (
    !assetId || !runpodJobId ||
    typeof assetId !== 'string' ||
    typeof runpodJobId !== 'string'
  ) {
    res.status(400).json({ error: 'assetId and runpodJobId query params are required' })
    return
  }

  res.setHeader('Cache-Control', 'no-store')

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, familyspaceId: user.familyspaceId },
    select: {
      id: true,
      processingStatus: true,
      transcript: true,
      durationSeconds: true,
      storagePath: true,
      storageType: true,
      filename: true,
      originalName: true,
    },
  })

  if (!asset) {
    res.status(404).json({ error: 'Asset not found' })
    return
  }

  if (asset.processingStatus === 'COMPLETED') {
    res.status(200).json({
      complete: true,
      data: {
        assetId: asset.id,
        fileId: asset.id,
        filePath: asset.storagePath,
        fileName: asset.originalName,
        duration: asset.durationSeconds ?? 0,
        transcript: asset.transcript,
        storageType: asset.storageType,
      },
    })
    return
  }

  if (asset.processingStatus === 'FAILED') {
    res.status(200).json({ failed: true, error: 'Voice sample processing failed' })
    return
  }

  try {
    const provider = new RunPodTTSProvider()
    const jobStatus = await provider.checkUploadJob(runpodJobId)

    if (jobStatus.status === 'complete' && jobStatus.result) {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          processingStatus: 'COMPLETED',
          transcript: jobStatus.result.transcript,
          durationSeconds: jobStatus.result.duration,
          storagePath: jobStatus.result.filePath,
        },
      })

      res.status(200).json({
        complete: true,
        data: {
          assetId,
          ...jobStatus.result,
        },
      })
      return
    }

    if (jobStatus.status === 'failed') {
      await prisma.asset.update({
        where: { id: assetId },
        data: { processingStatus: 'FAILED' },
      }).catch(() => undefined)

      res.status(200).json({ failed: true, error: jobStatus.error ?? 'Job failed' })
      return
    }

    res.status(200).json({
      status: 'processing',
      runpodStatus: jobStatus.runpodStatus,
      delayTime: jobStatus.delayTime,
      executionTime: jobStatus.executionTime,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Status check failed'
    logger.error('[API] upload-status error:', message)
    res.status(503).json({ failed: true, error: message })
  }
}

export default handler
