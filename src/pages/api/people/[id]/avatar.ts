import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import formidable from 'formidable'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

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
      uploadDir: avatarDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filename: (_name, ext) => `${uuidv4()}${ext}`,
      filter: ({ mimetype }) => {
        return !!mimetype && mimetype.startsWith('image/')
      },
    })

    const [, files] = await form.parse(req)

    const fileArray = files.file || files.avatar
    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No image file provided', 400)
    }

    const file = fileArray[0]
    const relativePath = path.relative(process.cwd(), file.filepath)

    // Create an asset record and link it to the person
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          workspaceId: user.workspaceId,
          filename: path.basename(file.filepath),
          originalName: file.originalFilename || 'avatar',
          mimeType: file.mimetype || 'image/jpeg',
          sizeBytes: BigInt(file.size),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'IMAGE',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
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
