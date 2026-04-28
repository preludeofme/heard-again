import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validateFileContent, generateSecureFilename, ALLOWED_MIME_TYPES } from '@/lib/security/file-validator'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join(process.cwd(), 'imports')

// Allowed MIME types for bulk audio import
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
] as const

function resolveAssetType(mimeType: string): 'AUDIO' | 'DOCUMENT' {
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  return 'DOCUMENT'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const familyspaceDir = path.join(IMPORT_DIR, user.familyspaceId, 'bulk-audio')
    await fs.mkdir(familyspaceDir, { recursive: true })

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions
      maxFileSize: 250 * 1024 * 1024,
      uploadDir: familyspaceDir, // Restrict to secure familyspace directory
      filename: () => `${uuidv4()}.tmp`, // Use temporary extension
      multiples: true,
    })

    const [, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No files provided', 400)
    }

    const validatedAudioFiles: Array<formidable.File & { 
      secureFilename: string;
      mimetype: string;
      originalFilename: string;
    }> = []
    
    for (const file of fileArray) {
      // Validate file content to prevent malicious uploads
      const fileBuffer = await fs.readFile(file.filepath)
      
      const validationResult = await validateFileContent(
        fileBuffer,
        file.originalFilename || 'unknown',
        file.mimetype || undefined
      )

      if (!validationResult.isValid) {
        logger.error('File validation failed:', {
          filename: file.originalFilename,
          error: validationResult.error,
          securityRisk: validationResult.securityRisk,
          detectedType: validationResult.detectedType
        })
        
        // Clean up temporary file
        await fs.unlink(file.filepath).catch(() => {})
        
        return errorResponse(
          res,
          validationResult.error || 'File validation failed',
          400
        )
      }

      // Ensure file is an allowed audio type
      if (!ALLOWED_AUDIO_MIME_TYPES.includes(validationResult.detectedType! as any)) {
        await fs.unlink(file.filepath).catch(() => {})
        return errorResponse(res, `File type '${validationResult.detectedType}' is not allowed for audio import`, 400)
      }

      // Generate secure filename with proper extension
      const secureFilename = generateSecureFilename(
        file.originalFilename || 'audio-file',
        validationResult.detectedType!
      )

      // Move to final location with secure name
      const finalPath = path.join(familyspaceDir, secureFilename)
      await fs.rename(file.filepath, finalPath)

      validatedAudioFiles.push({
        ...file,
        filepath: finalPath,
        originalFilename: file.originalFilename || 'audio-file',
        mimetype: validationResult.detectedType!,
        secureFilename
      })
    }

    if (validatedAudioFiles.length === 0) {
      return errorResponse(res, 'No valid audio files found in upload', 400)
    }

    const createdAssets = await prisma.$transaction(async (tx) => {
      const results = []
      for (const file of validatedAudioFiles) {
        const relativePath = path.relative(process.cwd(), file.filepath)
        const asset = await tx.asset.create({
          data: {
            familyspaceId: user.familyspaceId,
            filename: path.basename(file.filepath),
            originalName: file.originalFilename,
            mimeType: file.mimetype,
            sizeBytes: BigInt(file.size),
            storageType: 'LOCAL',
            storagePath: relativePath,
            assetType: resolveAssetType(file.mimetype),
            processingStatus: 'COMPLETED',
            uploadedById: user.id,
            metadata: {
              importType: 'BULK_AUDIO',
              validatedType: file.mimetype,
              secureFilename: file.secureFilename,
            },
          },
        })
        results.push(asset)
      }
      return results
    })

    const importJob = await prisma.importJob.create({
      data: {
        familyspaceId: user.familyspaceId,
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
