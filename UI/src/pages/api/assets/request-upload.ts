import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { S3StorageProvider } from '@/lib/storage/providers/s3-provider'
import { apiHandler, errorResponse } from '@/lib/api-helpers'
import { v4 as uuidv4 } from 'uuid'

const PRESIGNED_EXPIRES_SECONDS = 900 // 15 min

export default apiHandler({
  POST: async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { filename, mimeType, fileSize } = req.body as {
      filename?: string
      mimeType?: string
      fileSize?: number
    }

    if (!filename || !mimeType) {
      return errorResponse(res, 'filename and mimeType are required', 400)
    }

    const storage = getStorageService()
    const rawProvider = storage.getProvider()

    if (!(rawProvider instanceof S3StorageProvider)) {
      return errorResponse(res, 'Presigned uploads require R2/S3 storage mode', 400)
    }

    const ext = filename.split('.').pop() ?? 'bin'
    const folder = mimeType.startsWith('audio/') ? 'recordings' : 'uploads'
    const key = `${folder}/${user.familyspaceId}/${uuidv4()}.${ext}`

    const uploadUrl = await rawProvider.getPresignedUploadUrl(key, mimeType, PRESIGNED_EXPIRES_SECONDS)

    const assetType = mimeType.startsWith('audio/')
      ? 'AUDIO'
      : mimeType.startsWith('video/')
      ? 'VIDEO'
      : mimeType.startsWith('image/')
      ? 'IMAGE'
      : 'DOCUMENT'

    const asset = await prisma.asset.create({
      data: {
        familyspaceId: user.familyspaceId,
        filename: `${uuidv4()}.${ext}`,
        originalName: filename,
        mimeType,
        sizeBytes: BigInt(fileSize ?? 0),
        storageType: 'CLOUDFLARE_R2',
        storagePath: key,
        assetType: assetType as any,
        isAISynthesized: false,
        processingStatus: 'COMPLETED',
        uploadedById: user.id,
        metadata: {},
      },
    })

    logger.info('[API] assets/request-upload: asset created', { assetId: asset.id, assetType })

    return res.status(200).json({
      assetId: asset.id,
      uploadUrl,
      expiresAt: new Date(Date.now() + PRESIGNED_EXPIRES_SECONDS * 1000).toISOString(),
    })
  },
})
