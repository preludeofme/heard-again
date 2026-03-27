import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { FileOptimizer } from '@/lib/file-optimizer'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'

// Disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const storageService = getStorageService()
    const storageMode = storageService.getMode()
    const fileOptimizer = new FileOptimizer()

    const form = formidable({
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    })

    const [fields, files] = await form.parse(req)

    const fileArray = files.file
    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No file provided', 400)
    }

    const file = fileArray[0]

    // Convert formidable file to buffer for optimization
    const fileBuffer = require('fs').readFileSync(file.filepath)
    const originalSize = fileBuffer.length

    // Check if file can be optimized
    const canOptimize = fileOptimizer.canOptimize(file.mimetype || '')
    
    let optimizedBuffer = fileBuffer
    let optimizationResult = null

    if (canOptimize) {
      try {
        optimizationResult = await fileOptimizer.optimizeFile(
          fileBuffer,
          file.mimetype || 'application/octet-stream',
          file.originalFilename || 'unknown',
          {
            quality: 85, // Default quality
            maxWidth: 2048,
            maxHeight: 2048,
            maxFileSize: 50 * 1024 * 1024, // 50MB target
          }
        )
        optimizedBuffer = optimizationResult.optimizedFile
        
        console.log(`File optimization completed:`, {
          originalSize: (originalSize / 1024 / 1024).toFixed(2) + 'MB',
          optimizedSize: (optimizationResult.optimizedSize / 1024 / 1024).toFixed(2) + 'MB',
          compressionRatio: (1 - optimizationResult.compressionRatio).toFixed(2) + '% reduction',
          method: optimizationResult.optimizationMethod
        })
      } catch (error) {
        console.error('File optimization failed, using original:', error)
        // Continue with original file if optimization fails
      }
    }

    // Upload file using storage service
    const uploadResult = await storageService.uploadFile(
      optimizedBuffer,
      file.originalFilename || 'unknown',
      file.mimetype || 'application/octet-stream',
      {
        folder: `workspace-${user.workspaceId}`,
        metadata: {
          uploadedById: user.id,
          workspaceId: user.workspaceId,
          originalName: file.originalFilename || 'unknown',
          originalSize: originalSize.toString(),
          optimizedSize: optimizedBuffer.length.toString(),
          optimizationMethod: optimizationResult?.optimizationMethod || 'none',
          compressionRatio: optimizationResult?.compressionRatio?.toString() || '1',
        },
      }
    )

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: uploadResult.filename,
        originalName: file.originalFilename || 'unknown',
        mimeType: optimizationResult?.mimeType || file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(uploadResult.sizeBytes),
        storageType: storageMode.toUpperCase() as any,
        storagePath: uploadResult.storagePath,
        assetType: uploadResult.assetType as any,
        processingStatus: uploadResult.processingStatus,
        uploadedById: user.id,
      },
    })

    return successResponse(res, {
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      assetType: asset.assetType,
      processingStatus: asset.processingStatus,
      storageType: asset.storageType,
      publicUrl: uploadResult.publicUrl,
      createdAt: asset.createdAt,
      optimization: optimizationResult ? {
        originalSize,
        optimizedSize: optimizationResult.optimizedSize,
        compressionRatio: optimizationResult.compressionRatio,
        method: optimizationResult.optimizationMethod,
        sizeSaved: originalSize - optimizationResult.optimizedSize,
        sizeSavedPercentage: ((originalSize - optimizationResult.optimizedSize) / originalSize * 100).toFixed(1) + '%'
      } : null
    }, 201)
  } catch (error: any) {
    console.error('Upload error:', error)
    if (error.statusCode) {
      return errorResponse(res, error.message, error.statusCode)
    }
    return errorResponse(res, error.message || 'Upload failed', 500)
  }
}
