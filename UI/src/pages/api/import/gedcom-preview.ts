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

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join('/tmp', 'heard-again-imports')

const ALLOWED_GEDCOM_MIME_TYPES = [
  'text/plain',
  'application/octet-stream',
] as const

async function previewGedcom(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const familyspaceDir = path.join(IMPORT_DIR, user.familyspaceId, 'gedcom')
  await fs.mkdir(familyspaceDir, { recursive: true })

  const form = formidable({
    keepExtensions: false,
    maxFileSize: 100 * 1024 * 1024,
    uploadDir: familyspaceDir,
    filename: () => `${uuidv4()}.tmp`,
  })

  const [, files] = await form.parse(req)
  const fileArray = files.file

  if (!fileArray || fileArray.length === 0) {
    return errorResponse(res, 'No GEDCOM file provided', 400)
  }

  const file = fileArray[0]

  const fileBuffer = await fs.readFile(file.filepath)
  const validationResult = await validateFileContent(
    fileBuffer,
    file.originalFilename || 'gedcom.ged',
    file.mimetype || undefined
  )

  if (!validationResult.isValid) {
    await fs.unlink(file.filepath).catch(() => {})
    return errorResponse(res, validationResult.error || 'Validation failed', 400)
  }

  const secureFilename = generateSecureFilename(
    file.originalFilename || 'gedcom.ged',
    'text/plain'
  ).replace(/\.[^.]+$/, '.ged')

  const finalPath = path.join(familyspaceDir, secureFilename)
  await fs.rename(file.filepath, finalPath)

  // Create asset record so we can reference it later
  const asset = await prisma.asset.create({
    data: {
      familyspaceId: user.familyspaceId,
      filename: path.basename(finalPath),
      originalName: file.originalFilename || 'import.ged',
      mimeType: 'text/plain',
      sizeBytes: BigInt(fileBuffer.length),
      storageType: 'LOCAL',
      storagePath: path.relative(process.cwd(), finalPath),
      assetType: 'DOCUMENT',
      processingStatus: 'PENDING',
      uploadedById: user.id,
      metadata: {
        importType: 'GEDCOM',
        secureFilename: secureFilename,
      },
    },
  })

  try {
    const previewData = await gedcomImportService.previewGedcom(user.id, finalPath)
    
    // Also return a list of all individuals for parent selection
    const { individuals } = require('@/server/services/gedcom/GedcomParser').GedcomParser.parse(
      await fs.readFile(finalPath, 'utf-8')
    )

    return successResponse(res, {
      assetId: asset.id,
      preview: previewData,
      allIndividuals: individuals.map((i: any) => ({
        xref: i.xref,
        fullName: i.fullName,
        firstName: i.firstName,
        lastName: i.lastName,
        birthDate: i.birthDate,
      }))
    })
  } catch (err: any) {
    logger.error(`GEDCOM preview failed: ${err.message}`)
    return errorResponse(res, 'Failed to parse GEDCOM for preview', 500)
  }
}

export default apiHandler({
  POST: previewGedcom
})
