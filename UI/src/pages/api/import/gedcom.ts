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
import { importQueue } from '@/lib/queues/importQueue'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IMPORT_DIR = path.join('/tmp', 'heard-again-imports')

// Allowed MIME types for GEDCOM files
const ALLOWED_GEDCOM_MIME_TYPES = [
  'text/plain',
  'application/octet-stream',
] as const

async function importGedcom(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  // Check if this is a JSON request with assetId (committed after preview)
  const contentType = req.headers['content-type']
  if (contentType?.includes('application/json')) {
    // Re-enable bodyParser for this branch manually
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString())
    const { assetId, options } = body

    if (!assetId) return errorResponse(res, 'Asset ID required', 400)

    const asset = await prisma.asset.findUnique({
      where: { id: assetId, familyspaceId: user.familyspaceId }
    })

    if (!asset) return errorResponse(res, 'Asset not found', 404)
    if (!importQueue) return errorResponse(res, 'Import queue unavailable in this environment', 503)

    const importJob = await prisma.importJob.create({
      data: {
        familyspaceId: user.familyspaceId,
        sourceType: 'GEDCOM',
        sourceAssetId: asset.id,
        status: 'PENDING',
        importedById: user.id,
      },
    })

    await importQueue.add(`gedcom-import-${importJob.id}`, {
      familyspaceId: user.familyspaceId,
      userId: user.id,
      filePath: path.join(process.cwd(), asset.storagePath),
      assetId: asset.id,
      jobId: importJob.id,
      importType: 'GEDCOM',
      options
    })

    return successResponse(res, { jobId: importJob.id, status: 'PENDING' })
  }

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

  // Validate file content
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

  if (!ALLOWED_GEDCOM_MIME_TYPES.includes(validationResult.detectedType! as any)) {
    await fs.unlink(file.filepath).catch(() => {})
    return errorResponse(res, `File type '${validationResult.detectedType}' not allowed`, 400)
  }

  // Generate secure filename
  const secureFilename = generateSecureFilename(
    file.originalFilename || 'gedcom.ged',
    'text/plain'
  ).replace(/\.[^.]+$/, '.ged')

  const finalPath = path.join(familyspaceDir, secureFilename)
  await fs.rename(file.filepath, finalPath)
  const relativePath = path.relative(process.cwd(), finalPath)

  // Create asset and job records
  const [asset, importJob] = await prisma.$transaction(async (tx) => {
    const createdAsset = await tx.asset.create({
      data: {
        familyspaceId: user.familyspaceId,
        filename: path.basename(finalPath),
        originalName: file.originalFilename || 'import.ged',
        mimeType: 'text/plain',
        sizeBytes: BigInt(fileBuffer.length),
        storageType: 'LOCAL',
        storagePath: relativePath,
        assetType: 'DOCUMENT',
        processingStatus: 'PENDING',
        uploadedById: user.id,
        metadata: {
          importType: 'GEDCOM',
          secureFilename: secureFilename,
        },
      },
    })

    const createdJob = await tx.importJob.create({
      data: {
        familyspaceId: user.familyspaceId,
        sourceType: 'GEDCOM',
        sourceAssetId: createdAsset.id,
        status: 'PENDING',
        importedById: user.id,
      },
    })

    return [createdAsset, createdJob]
  })

  // Enqueue the background job
  if (!importQueue) return errorResponse(res, 'Import queue unavailable in this environment', 503)
  await importQueue.add(`gedcom-import-${importJob.id}`, {
    familyspaceId: user.familyspaceId,
    userId: user.id,
    filePath: finalPath,
    assetId: asset.id,
    jobId: importJob.id,
    importType: 'GEDCOM',
  })

  return successResponse(res, {
    jobId: importJob.id,
    status: importJob.status,
    sourceAssetId: asset.id,
    fileName: asset.originalName,
  }, 202) // 202 Accepted
}

export default apiHandler({
  POST: importGedcom
})
