import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { logger } from '@/lib/logger'

export const config = {
  api: {
    bodyParser: false,
  },
}

const readRawBody = (req: NextApiRequest): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { assetId } = req.query

    if (typeof assetId !== 'string') {
      res.status(400).json({ error: 'assetId is required' })
      return
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, familyspaceId: user.familyspaceId },
    })

    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }

    const body = await readRawBody(req)
    const mimeType = req.headers['content-type'] ?? asset.mimeType

    const storage = getStorageService()
    const uploadResult = await storage.uploadFile(body, asset.originalName, mimeType, {
      folder: `tts-staging/${user.familyspaceId}`,
    })

    await prisma.asset.update({
      where: { id: assetId },
      data: {
        storagePath: uploadResult.storagePath,
        sizeBytes: BigInt(body.length),
        processingStatus: 'PENDING',
      },
    })

    res.status(200).json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Local upload failed'
    logger.error('[API] local-upload error:', message)
    res.status(500).json({ error: message })
  }
}
