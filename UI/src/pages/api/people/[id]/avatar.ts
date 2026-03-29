import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
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

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

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
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) {
      return errorResponse(res, 'Person not found', 404)
    }

    // Create avatars directory
    const avatarDir = path.join(UPLOAD_DIR, user.workspaceId, 'avatars')
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true })
    }

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions
      maxFileSize: 5 * 1024 * 1024, // 5MB
      uploadDir: avatarDir, // Restrict to secure avatar directory
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
      console.error('Avatar file validation failed:', {
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

    // Move to final location with secure name
    const finalPath = path.join(avatarDir, secureFilename)
    fs.renameSync(file.filepath, finalPath)

    // Create an asset record and link it to the person
    const relativePath = path.relative(process.cwd(), finalPath)
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: path.basename(finalPath),
          originalName: file.originalFilename || 'avatar',
          mimeType: validationResult.detectedType!,
          sizeBytes: BigInt(fileBuffer.length),
          storageType: 'LOCAL',
          storagePath: relativePath,
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
