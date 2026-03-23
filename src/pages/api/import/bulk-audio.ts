import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join(process.cwd(), 'imports')

function resolveAssetType(mimeType: string): 'AUDIO' | 'DOCUMENT' {
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  return 'DOCUMENT'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const workspaceDir = path.join(IMPORT_DIR, user.workspaceId, 'bulk-audio')
    await fs.mkdir(workspaceDir, { recursive: true })

    const form = formidable({
      uploadDir: workspaceDir,
      keepExtensions: true,
      maxFileSize: 250 * 1024 * 1024,
      filename: (_name, ext) => `${uuidv4()}${ext || ''}`,
      multiples: true,
    })

    const [, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No files provided', 400)
    }

    const acceptedAudioFiles = fileArray.filter((file) => (file.mimetype || '').startsWith('audio/'))
    if (acceptedAudioFiles.length === 0) {
      return errorResponse(res, 'No audio files found in upload', 400)
    }

    const createdAssets = await prisma.$transaction(async (tx) => {
      const results = []
      for (const file of acceptedAudioFiles) {
        const relativePath = path.relative(process.cwd(), file.filepath)
        const asset = await tx.asset.create({
          data: {
            workspaceId: user.workspaceId,
            filename: path.basename(file.filepath),
            originalName: file.originalFilename || 'audio-file',
            mimeType: file.mimetype || 'application/octet-stream',
            sizeBytes: BigInt(file.size),
            storageType: 'LOCAL',
            storagePath: relativePath,
            assetType: resolveAssetType(file.mimetype || ''),
            processingStatus: 'COMPLETED',
            uploadedById: user.id,
            metadata: {
              importType: 'BULK_AUDIO',
            },
          },
        })
        results.push(asset)
      }
      return results
    })

    const importJob = await prisma.importJob.create({
      data: {
        workspaceId: user.workspaceId,
        sourceType: 'CSV',
        status: 'COMPLETED',
        importedById: user.id,
        startedAt: new Date(),
        completedAt: new Date(),
        resultSummary: {
          importedAudioAssets: createdAssets.length,
          skippedFiles: fileArray.length - createdAssets.length,
        },
      },
    })

    return successResponse(res, {
      jobId: importJob.id,
      status: importJob.status,
      sourceType: 'BULK_AUDIO',
      importedCount: createdAssets.length,
      skippedCount: fileArray.length - createdAssets.length,
      assetIds: createdAssets.map((asset) => asset.id),
      resultSummary: importJob.resultSummary,
    }, 201)
  } catch (error: any) {
    return errorResponse(res, error.message || 'Bulk audio import failed', error.statusCode || 500)
  }
}
