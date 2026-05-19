import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { S3StorageProvider } from '@/lib/storage/providers/s3-provider'
import { v4 as uuidv4 } from 'uuid'

const PRESIGNED_EXPIRES_SECONDS = 900 // 15 min

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { filename, mimeType, fileSize } = req.body as {
      filename?: string
      mimeType?: string
      fileSize?: number
    }

    if (!filename || !mimeType) {
      res.status(400).json({ error: 'filename and mimeType are required' })
      return
    }

    const storage = getStorageService()
    const rawProvider = storage.getProvider()
    const ext = filename.split('.').pop() ?? 'wav'

    // Local storage mode: return a local API endpoint instead of a presigned URL
    if (!(rawProvider instanceof S3StorageProvider)) {
      const key = `tts-staging/${user.familyspaceId}/${uuidv4()}.${ext}`
      const asset = await prisma.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: `${uuidv4()}.${ext}`,
          originalName: filename,
          mimeType,
          sizeBytes: BigInt(fileSize ?? 0),
          storageType: 'LOCAL',
          storagePath: key,
          assetType: 'AUDIO',
          isAISynthesized: true,
          processingStatus: 'PENDING',
          uploadedById: user.id,
          metadata: {},
        },
      })
      res.status(200).json({
        assetId: asset.id,
        uploadUrl: `/api/voice/local-upload?assetId=${asset.id}`,
        expiresAt: new Date(Date.now() + PRESIGNED_EXPIRES_SECONDS * 1000).toISOString(),
      })
      return
    }

    const key = `tts-staging/${user.familyspaceId}/${uuidv4()}.${ext}`
    const uploadUrl = await rawProvider.getPresignedUploadUrl(key, mimeType, PRESIGNED_EXPIRES_SECONDS)

    const asset = await prisma.asset.create({
      data: {
        familyspaceId: user.familyspaceId,
        filename: `${uuidv4()}.${ext}`,
        originalName: filename,
        mimeType,
        sizeBytes: BigInt(fileSize ?? 0),
        storageType: 'CLOUDFLARE_R2',
        storagePath: key,
        assetType: 'AUDIO',
        isAISynthesized: true,
        processingStatus: 'PENDING',
        uploadedById: user.id,
        metadata: {},
      },
    })

    res.status(200).json({
      assetId: asset.id,
      uploadUrl,
      expiresAt: new Date(Date.now() + PRESIGNED_EXPIRES_SECONDS * 1000).toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create upload URL'
    logger.error('[API] request-upload error:', message)
    res.status(503).json({ error: message })
  }
}

export default handler
