import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, apiHandler } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validateFileContent, generateSecureFilename } from '@/lib/security/file-validator'
import { gedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { getStorageService } from '@/lib/storage/storage-service'
import { GedcomParser } from '@/server/services/gedcom/GedcomParser'

export const config = {
  api: {
    bodyParser: false,
  },
}

const ALLOWED_GEDCOM_MIME_TYPES = [
  'text/plain',
  'application/octet-stream',
] as const

function storageTypeFromMode(mode: string): 'LOCAL' | 'S3' | 'CLOUDFLARE_R2' | 'GOOGLE_CLOUD' {
  switch (mode) {
    case 'r2': return 'CLOUDFLARE_R2'
    case 's3': return 'S3'
    case 'gcs':
    case 'gcp': return 'GOOGLE_CLOUD'
    default: return 'LOCAL'
  }
}

async function previewGedcom(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const tmpDir = path.join('/tmp', 'heard-again-gedcom-tmp')
  await fs.mkdir(tmpDir, { recursive: true })

  const form = formidable({
    keepExtensions: false,
    maxFileSize: 100 * 1024 * 1024,
    uploadDir: tmpDir,
    filename: () => `${uuidv4()}.tmp`,
  })

  const [, files] = await form.parse(req)
  const fileArray = files.file

  if (!fileArray || fileArray.length === 0) {
    return errorResponse(res, 'No GEDCOM file provided', 400)
  }

  const file = fileArray[0]

  const fileBuffer = await fs.readFile(file.filepath)
  await fs.unlink(file.filepath).catch(() => {})

  const validationResult = await validateFileContent(
    fileBuffer,
    file.originalFilename || 'gedcom.ged',
    file.mimetype || undefined
  )

  if (!validationResult.isValid) {
    return errorResponse(res, validationResult.error || 'Validation failed', 400)
  }

  if (!ALLOWED_GEDCOM_MIME_TYPES.includes(validationResult.detectedType! as 'text/plain' | 'application/octet-stream')) {
    return errorResponse(res, `File type '${validationResult.detectedType}' not allowed`, 400)
  }

  const secureFilename = generateSecureFilename(
    file.originalFilename || 'gedcom.ged',
    'text/plain'
  ).replace(/\.[^.]+$/, '.ged')

  const storageService = getStorageService()
  const uploadResult = await storageService.uploadFile(
    fileBuffer,
    secureFilename,
    'text/plain',
    { folder: `familyspace-${user.familyspaceId}/gedcom` }
  )

  const asset = await prisma.asset.create({
    data: {
      familyspaceId: user.familyspaceId,
      filename: uploadResult.filename,
      originalName: file.originalFilename || 'import.ged',
      mimeType: 'text/plain',
      sizeBytes: BigInt(uploadResult.sizeBytes),
      storageType: storageTypeFromMode(storageService.getMode()) as any,
      storagePath: uploadResult.storagePath,
      assetType: 'DOCUMENT',
      processingStatus: 'PENDING',
      uploadedById: user.id,
      metadata: {
        importType: 'GEDCOM',
        secureFilename,
      },
    },
  })

  try {
    const fileContent = fileBuffer.toString('utf-8')
    const previewData = await gedcomImportService.previewGedcom(user.id, fileContent)
    const { individuals } = GedcomParser.parse(fileContent)

    return successResponse(res, {
      assetId: asset.id,
      preview: previewData,
      allIndividuals: individuals.map((i) => ({
        xref: i.xref,
        fullName: i.fullName,
        firstName: i.firstName,
        lastName: i.lastName,
        birthDate: i.birthDate,
      }))
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`GEDCOM preview failed: ${message}`)
    return errorResponse(res, 'Failed to parse GEDCOM for preview', 500)
  }
}

export default apiHandler({
  POST: previewGedcom
})
