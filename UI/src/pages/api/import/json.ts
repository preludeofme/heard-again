import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validateFileContent, generateSecureFilename } from '@/lib/security/file-validator'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join(process.cwd(), 'imports')

// Allowed MIME types for JSON import
const ALLOWED_JSON_MIME_TYPES = [
  'application/json',
  'text/plain',
  'application/octet-stream',
] as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const familyspaceDir = path.join(IMPORT_DIR, user.familyspaceId, 'json')
    await fs.mkdir(familyspaceDir, { recursive: true })

    const form = formidable({
      keepExtensions: false, // Don't trust original extensions
      maxFileSize: 100 * 1024 * 1024,
      uploadDir: familyspaceDir, // Restrict to secure familyspace directory
      filename: () => `${uuidv4()}.tmp`, // Use temporary extension
    })

    const [, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No JSON file provided', 400)
    }

    const file = fileArray[0]

    // Validate file content to prevent malicious uploads
    const fileBuffer = await fs.readFile(file.filepath)
    
    const validationResult = await validateFileContent(
      fileBuffer,
      file.originalFilename || 'backup.json',
      file.mimetype || undefined
    )

    if (!validationResult.isValid) {
      logger.error('JSON file validation failed:', {
        filename: file.originalFilename,
        error: validationResult.error,
        securityRisk: validationResult.securityRisk,
        detectedType: validationResult.detectedType
      })
      
      // Clean up temporary file
      await fs.unlink(file.filepath).catch(() => {})
      
      return errorResponse(
        res,
        validationResult.error || 'JSON file validation failed',
        400
      )
    }

    // Ensure file is an allowed type for JSON
    if (!ALLOWED_JSON_MIME_TYPES.includes(validationResult.detectedType! as any)) {
      await fs.unlink(file.filepath).catch(() => {})
      return errorResponse(res, `File type '${validationResult.detectedType}' is not allowed for JSON import`, 400)
    }

    // Generate secure filename with .json extension
    const secureFilename = generateSecureFilename(
      file.originalFilename || 'backup.json',
      'application/json' // Force JSON MIME
    ).replace(/\.[^.]+$/, '.json') // Force .json extension

    // Move to final location with secure name
    const finalPath = path.join(familyspaceDir, secureFilename)
    await fs.rename(file.filepath, finalPath)

    const content = await fs.readFile(finalPath, 'utf-8')

    let parsed: any = null
    try {
      parsed = JSON.parse(content)
    } catch {
      return errorResponse(res, 'Invalid JSON file', 400)
    }

    const peopleCount = Array.isArray(parsed?.data?.people) ? parsed.data.people.length : 0
    const storiesCount = Array.isArray(parsed?.data?.stories) ? parsed.data.stories.length : 0
    const assetsCount = Array.isArray(parsed?.data?.assets) ? parsed.data.assets.length : 0
    const relativePath = path.relative(process.cwd(), finalPath)

    const [asset, importJob] = await prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: path.basename(finalPath),
          originalName: file.originalFilename || 'backup.json',
          mimeType: 'application/json',
          sizeBytes: BigInt(fileBuffer.length),
          storageType: 'LOCAL',
          storagePath: relativePath,
          assetType: 'DOCUMENT',
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          metadata: {
            importType: 'JSON',
            validatedType: 'application/json',
            secureFilename: secureFilename,
          },
        },
      })

      const createdJob = await tx.importJob.create({
        data: {
          familyspaceId: user.familyspaceId,
          sourceType: 'JSON',
          sourceAssetId: createdAsset.id,
          status: 'COMPLETED',
          importedById: user.id,
          startedAt: new Date(),
          completedAt: new Date(),
          resultSummary: {
            importedPeopleEstimate: peopleCount,
            importedStoriesEstimate: storiesCount,
            importedAssetsEstimate: assetsCount,
          },
        },
      })

      return [createdAsset, createdJob]
    })

    return successResponse(res, {
      jobId: importJob.id,
      status: importJob.status,
      sourceType: importJob.sourceType,
      sourceAssetId: asset.id,
      fileName: asset.originalName,
      resultSummary: importJob.resultSummary,
    }, 201)
  } catch (error: any) {
    return errorResponse(res, error.message || 'JSON import failed', error.statusCode || 500)
  }
}
