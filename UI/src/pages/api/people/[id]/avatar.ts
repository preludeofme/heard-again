import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import formidable from 'formidable'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { NextApiRequest, NextApiResponse } from 'next'
import { validateFileContent, generateSecureFilename, ALLOWED_MIME_TYPES } from '@/lib/security/file-validator'

export const config = {
  api: {
    bodyParser: false,
  },
}

// Allowed MIME types for avatar images
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
] as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const person = await prisma.person.findFirst({
      where: { id: personId, familyspaceId: user.familyspaceId },
    })
    if (!person) {
      return errorResponse(res, 'Person not found', 404)
    }

    // Use a temp directory for formidable — cleaned up after upload
    const tempDir = path.join('/tmp', 'heard-again-uploads', 'avatars', user.familyspaceId)
    fs.mkdirSync(tempDir, { recursive: true })

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions
      maxFileSize: 5 * 1024 * 1024, // 5MB
      uploadDir: tempDir, // Temporary directory — cleaned up after use
      filename: () => `${uuidv4()}.tmp`, // Use temporary extension
      filter: ({ mimetype }) => {
        // Basic filter - will be validated more thoroughly below
        return !!mimetype && mimetype.startsWith('image/')
      },
    })

    const [, files] = await form.parse(req)

    const fileArray = files.file || files.avatar
    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No image file provided', 400)
    }

    const file = fileArray[0]

    // Validate file content to prevent malicious uploads
    const fileBuffer = fs.readFileSync(file.filepath)
    
    const validationResult = await validateFileContent(
      fileBuffer,
      file.originalFilename || 'avatar',
      file.mimetype || undefined
    )

    if (!validationResult.isValid) {
      logger.error('Avatar file validation failed:', {
        filename: file.originalFilename,
        error: validationResult.error,
        securityRisk: validationResult.securityRisk,
        detectedType: validationResult.detectedType
      })
      
      // Clean up temporary file
      fs.unlinkSync(file.filepath)
      
      return errorResponse(
        res,
        validationResult.error || 'Avatar file validation failed',
        400
      )
    }

    // Ensure file is an allowed image type
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(validationResult.detectedType! as any)) {
      fs.unlinkSync(file.filepath)
      return errorResponse(res, `File type '${validationResult.detectedType}' is not allowed for avatar images`, 400)
    }

    // Generate secure filename with proper extension
    const secureFilename = generateSecureFilename(
      file.originalFilename || 'avatar',
      validationResult.detectedType!
    )

    // Upload to storage service — no persistent local write
    const storageService = getStorageService()
    const storageMode = storageService.getMode()
    const uploadResult = await storageService.uploadFile(
      fileBuffer,
      secureFilename,
      validationResult.detectedType!,
      {
        folder: `${user.familyspaceId}/avatars`,
        metadata: {
          uploadedById: user.id,
          familyspaceId: user.familyspaceId,
          originalName: file.originalFilename || 'avatar',
          importType: 'AVATAR',
          validatedType: validationResult.detectedType!,
        },
      }
    )

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath)
    } catch (cleanupError) {
      logger.warn('Failed to clean up avatar temp file:', cleanupError)
    }

    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      logger.warn('Failed to clean up avatar temp directory:', cleanupError)
    }

    // Create an asset record and link it to the person
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: uploadResult.filename,
          originalName: file.originalFilename || 'avatar',
          mimeType: validationResult.detectedType!,
          sizeBytes: BigInt(fileBuffer.length),
          storageType: storageMode.toUpperCase() as any,
          storagePath: uploadResult.storagePath,
          assetType: 'IMAGE',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            importType: 'AVATAR',
            validatedType: validationResult.detectedType,
            secureFilename: secureFilename,
          },
        },
      })

      const updated = await tx.person.update({
        where: { id: personId },
        data: { avatarAssetId: asset.id },
      })

      return { person: updated, asset }
    })

    return successResponse(res, {
      personId: result.person.id,
      avatarAssetId: result.asset.id,
      storagePath: result.asset.storagePath,
    })
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(res, error.message, error.statusCode)
    }
    return errorResponse(res, error.message || 'Avatar upload failed', 500)
  }
}
