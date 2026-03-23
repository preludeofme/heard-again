import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import formidable from 'formidable'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { NextApiRequest, NextApiResponse } from 'next'

// Disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

function resolveAssetType(mimeType: string): string {
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.includes('pdf')) return 'DOCUMENT'
  return 'DOCUMENT'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Create workspace-specific upload directory
    const workspaceDir = path.join(UPLOAD_DIR, user.workspaceId)
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true })
    }

    const form = formidable({
      uploadDir: workspaceDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filename: (_name, ext) => `${uuidv4()}${ext}`,
    })

    const [fields, files] = await form.parse(req)

    const fileArray = files.file
    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No file provided', 400)
    }

    const file = fileArray[0]
    const relativePath = path.relative(process.cwd(), file.filepath)

    const asset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: path.basename(file.filepath),
        originalName: file.originalFilename || 'unknown',
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        storageType: 'LOCAL',
        storagePath: relativePath,
        assetType: resolveAssetType(file.mimetype || '') as any,
        processingStatus: 'PENDING',
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
      createdAt: asset.createdAt,
    }, 201)
  } catch (error: any) {
    console.error('Upload error:', error)
    if (error.statusCode) {
      return errorResponse(res, error.message, error.statusCode)
    }
    return errorResponse(res, error.message || 'Upload failed', 500)
  }
}
